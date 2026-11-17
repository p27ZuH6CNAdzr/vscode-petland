/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import sinon from 'sinon';
import * as dom from '../../../../../base/browser/dom.js';
import { mainWindow } from '../../../../../base/browser/window.js';
import { DeferredPromise } from '../../../../../base/common/async.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { Disposable, DisposableStore, toDisposable } from '../../../../../base/common/lifecycle.js';
import { FileAccess, Schemas } from '../../../../../base/common/network.js';
import { constObservable, observableValue } from '../../../../../base/common/observable.js';
import { mock } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { NullLogService } from '../../../../../platform/log/common/log.js';
import { IQuickInputService, IQuickPickItem } from '../../../../../platform/quickinput/common/quickInput.js';
import { StorageScope, StorageTarget } from '../../../../../platform/storage/common/storage.js';
import { IChatPetService } from '../../../../../workbench/contrib/chat/browser/chatPetService.js';
import { IChatPetWidgetHost } from '../../../../../workbench/contrib/chat/browser/widget/chatPetWidget.js';
import { IChatEntitlementService } from '../../../../../workbench/services/chat/common/chatEntitlementService.js';
import { IWorkbenchEnvironmentService } from '../../../../../workbench/services/environment/common/environmentService.js';
import { IHostService } from '../../../../../workbench/services/host/browser/host.js';
import { TestChatEntitlementService, TestStorageService } from '../../../../../workbench/test/common/workbenchTestServices.js';
import { ChatPetCharacter, ISessionsChatPetCharacterService, SessionsChatPetCharacterService, SessionsChatPetCharacterWidget } from '../../browser/chatPetCharacter.js';
import { SelectChatPetCharacterAction } from '../../browser/chatPetCharacter.contribution.js';
import { ChatPetReplacementWidget } from '../../browser/chatPetReplacementWidget.js';

suite('Sessions - Chat Pet Character', () => {
	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	setup(() => {
		if (mainWindow.location.protocol === `${Schemas.file}:`) {
			sinon.stub(FileAccess, 'asBrowserUri').callsFake(resource => FileAccess.asFileUri(resource));
		}
	});
	teardown(() => sinon.restore());

	function createHost(parent = dom.$('div')): IChatPetWidgetHost {
		return {
			parent,
			dragBounds: parent,
			movementBounds: parent,
			model: constObservable(undefined),
			hasInput: constObservable(false),
			inputChanged: Event.None,
			getPlatformTop: () => undefined,
			onDidChangePlatform: Event.None,
		};
	}

	test('defaults to Blobby and restores a machine-local selection without touching Blobby preferences', () => {
		const storage = disposables.add(new TestStorageService());
		storage.store('chat.vscodePet.color', '#a277e6', StorageScope.APPLICATION, StorageTarget.USER);
		const writes: { key: string; target: StorageTarget | undefined }[] = [];
		disposables.add(storage.onDidChangeValue(StorageScope.APPLICATION, undefined, disposables.add(new DisposableStore()))(event => writes.push({ key: event.key, target: event.target })));
		const service = disposables.add(new SessionsChatPetCharacterService(storage, new NullLogService()));
		const initial = service.character.get();
		service.setCharacter('replacement');
		const restored = disposables.add(new SessionsChatPetCharacterService(storage, new NullLogService()));
		const afterRestart = restored.character.get();
		service.setCharacter('blobby');

		assert.deepStrictEqual({
			initial,
			afterRestart,
			synchronized: restored.character.get(),
			color: storage.get('chat.vscodePet.color', StorageScope.APPLICATION),
			writes,
		}, {
			initial: 'blobby',
			afterRestart: 'replacement',
			synchronized: 'blobby',
			color: '#a277e6',
			writes: [
				{ key: 'sessions.chatPet.character', target: StorageTarget.MACHINE },
				{ key: 'sessions.chatPet.character', target: StorageTarget.MACHINE },
			],
		});
	});

	test('switches implementations only on selection changes, disposes before creation, and preserves the latest host', () => {
		const character = observableValue<ChatPetCharacter>(disposables, 'blobby');
		const first = createHost();
		const second = createHost();
		const history: string[] = [];
		let live = 0;
		const widget = disposables.add(new SessionsChatPetCharacterWidget(first, character, (selected, host) => {
			assert.strictEqual(live, 0);
			live++;
			history.push(`create:${selected}:${host === second ? 'second' : 'first'}`);
			return new class extends Disposable {
				constructor() {
					super();
					this._register(toDisposable(() => {
						live--;
						history.push(`dispose:${selected}`);
					}));
				}
				setHost(nextHost: IChatPetWidgetHost): void {
					history.push(`host:${nextHost === second ? 'second' : 'first'}`);
				}
			}();
		}));
		character.set('replacement', undefined);
		character.set('replacement', undefined);
		widget.setHost(second);
		character.set('blobby', undefined);
		character.set('replacement', undefined);
		widget.dispose();
		character.set('blobby', undefined);

		assert.deepStrictEqual({ live, history }, {
			live: 0,
			history: [
				'create:blobby:first',
				'dispose:blobby',
				'create:replacement:first',
				'host:second',
				'dispose:replacement',
				'create:blobby:second',
				'dispose:blobby',
				'create:replacement:second',
				'dispose:replacement',
			],
		});
	});

	test('selection is unavailable outside the Agents window or after AI opt-out', async () => {
		const instantiation = disposables.add(new TestInstantiationService());
		const service = disposables.add(new SessionsChatPetCharacterService(disposables.add(new TestStorageService()), new NullLogService()));
		const entitlement = new class extends TestChatEntitlementService {
			override readonly sentiment = { hidden: false };
		}();
		let isSessionsWindow = false;
		let picks = 0;
		const pending = new DeferredPromise<IQuickPickItem & { character: ChatPetCharacter }>();
		instantiation.stub(IWorkbenchEnvironmentService, new class extends mock<IWorkbenchEnvironmentService>() {
			override get isSessionsWindow() { return isSessionsWindow; }
		}());
		instantiation.stub(IChatEntitlementService, entitlement);
		instantiation.stub(ISessionsChatPetCharacterService, service);
		instantiation.stub(IQuickInputService, new class extends mock<IQuickInputService>() {
			override pick<T extends IQuickPickItem>(): Promise<T | undefined> {
				throw new Error('Unexpected picker invocation');
			}
		}());
		const pick = sinon.stub(instantiation.get(IQuickInputService), 'pick').callsFake(() => {
			picks++;
			return pending.p;
		});
		const action = new SelectChatPetCharacterAction();
		await instantiation.invokeFunction(accessor => action.run(accessor));
		isSessionsWindow = true;
		entitlement.sentiment.hidden = true;
		await instantiation.invokeFunction(accessor => action.run(accessor));
		entitlement.sentiment.hidden = false;
		const selection = instantiation.invokeFunction(accessor => action.run(accessor));
		entitlement.sentiment.hidden = true;
		await pending.complete({ label: 'Replacement', character: 'replacement' });
		await selection;

		assert.deepStrictEqual({ picks, character: service.character.get(), called: pick.calledOnce }, { picks: 1, character: 'blobby', called: true });
	});

	test('renders a noninteractive placeholder at the perch and cleans up host changes, visibility, and disposal', async () => {
		const root = dom.$('div');
		root.style.cssText = 'position:fixed;left:0;top:0;width:800px;height:600px';
		const first = dom.append(root, dom.$('div'));
		first.style.cssText = 'position:absolute;left:100px;top:200px;width:400px;height:80px';
		const second = dom.append(root, dom.$('div'));
		second.style.cssText = 'position:absolute;left:200px;top:400px;width:200px;height:80px';
		mainWindow.document.body.append(root);
		disposables.add(toDisposable(() => root.remove()));
		const enabled = observableValue(disposables, true);
		const activeWindow = disposables.add(new Emitter<number>());
		const sentimentChanged = disposables.add(new Emitter<void>());
		const entitlement = new class extends TestChatEntitlementService {
			override readonly onDidChangeSentiment = sentimentChanged.event;
			override readonly sentiment = { hidden: false };
		}();
		let resize = () => { };
		let disconnected = false;
		const errors: string[] = [];
		class TestResizeObserver implements ResizeObserver {
			constructor(callback: ResizeObserverCallback) { resize = () => callback([], this); }
			observe(): void { }
			unobserve(): void { }
			disconnect(): void { disconnected = true; }
		}
		const widget = disposables.add(new ChatPetReplacementWidget(
			createHost(first),
			TestResizeObserver,
			new class extends mock<IChatPetService>() { override readonly enabled = enabled; }(),
			entitlement,
			new class extends mock<IHostService>() { override readonly onDidChangeActiveWindow = activeWindow.event; }(),
			new class extends NullLogService {
				override error(message: string | Error): void { errors.push(String(message)); }
			}(),
		));
		const image = first.querySelector<HTMLImageElement>('img.chat-pet-replacement')!;
		await image.decode();
		image.dispatchEvent(new mainWindow.Event('load'));
		const bounds = image.getBoundingClientRect();
		const initial = { left: bounds.left, bottom: bounds.bottom, width: bounds.width, height: bounds.height };
		enabled.set(false, undefined);
		const hiddenWhenDisabled = image.parentElement!.hidden;
		enabled.set(true, undefined);
		activeWindow.fire(-1);
		const hiddenInInactiveWindow = image.parentElement!.hidden;
		activeWindow.fire(dom.getWindowId(mainWindow));
		entitlement.sentiment.hidden = true;
		sentimentChanged.fire();
		const hiddenAfterOptOut = image.parentElement!.hidden;
		entitlement.sentiment.hidden = false;
		sentimentChanged.fire();
		widget.setHost(createHost(second));
		resize();
		const moved = { firstImages: first.querySelectorAll('img').length, left: image.getBoundingClientRect().left, bottom: image.getBoundingClientRect().bottom };
		const semantics = { ariaHidden: image.parentElement!.getAttribute('aria-hidden'), tabIndex: image.tabIndex, buttons: root.querySelectorAll('button').length };
		image.dispatchEvent(new mainWindow.Event('error'));
		const hiddenAfterImageError = image.parentElement!.hidden;
		widget.dispose();

		assert.deepStrictEqual({ initial, hiddenWhenDisabled, hiddenInInactiveWindow, hiddenAfterOptOut, moved, semantics, hiddenAfterImageError, errors, imagesAfterDispose: root.querySelectorAll('img').length, disconnected }, {
			initial: { left: 420, bottom: 200, width: 48, height: 48 },
			hiddenWhenDisabled: true,
			hiddenInInactiveWindow: true,
			hiddenAfterOptOut: true,
			moved: { firstImages: 0, left: 320, bottom: 400 },
			semantics: { ariaHidden: 'true', tabIndex: -1, buttons: 0 },
			hiddenAfterImageError: true,
			errors: ['[ChatPetReplacementWidget] Failed to load replacement character'],
			imagesAfterDispose: 0,
			disconnected: true,
		});
	});
});
