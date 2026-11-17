/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/chatPetReplacement.css';
import * as dom from '../../../../base/browser/dom.js';
import { Disposable, DisposableStore, toDisposable } from '../../../../base/common/lifecycle.js';
import { FileAccess } from '../../../../base/common/network.js';
import { autorun, observableFromEvent } from '../../../../base/common/observable.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IChatPetService } from '../../../../workbench/contrib/chat/browser/chatPetService.js';
import { getChatPetDefaultHorizontalPosition, IChatPetWidgetHost } from '../../../../workbench/contrib/chat/browser/widget/chatPetWidget.js';
import { ChatPetWindowOwnership } from '../../../../workbench/contrib/chat/browser/widget/chatPetWindowOwnership.js';
import { IChatEntitlementService } from '../../../../workbench/services/chat/common/chatEntitlementService.js';
import { IHostService } from '../../../../workbench/services/host/browser/host.js';

const displaySize = 48;

export class ChatPetReplacementWidget extends Disposable {
	private readonly overlay = dom.$('.chat-pet-overlay');
	private readonly image = dom.$<HTMLImageElement>('img.chat-pet-replacement');
	private readonly hostStore = this._register(new DisposableStore());
	private readonly resizeObserver;
	private visible = false;
	private loaded = false;

	constructor(
		private host: IChatPetWidgetHost,
		resizeObserverCtor: typeof ResizeObserver | undefined,
		@IChatPetService chatPetService: IChatPetService,
		@IChatEntitlementService entitlementService: IChatEntitlementService,
		@IHostService hostService: IHostService,
		@ILogService logService: ILogService,
	) {
		super();
		this.overlay.setAttribute('aria-hidden', 'true');
		this.image.alt = '';
		this.image.draggable = false;
		this.overlay.append(this.image);
		this.overlay.hidden = true;
		this._register(toDisposable(() => {
			this.host.setPlatformOccupation?.(undefined);
			this.overlay.remove();
			this.host.parent.classList.remove('chat-pet-host');
		}));
		this.resizeObserver = this._register(new dom.DisposableResizeObserver('ChatPetReplacementWidget', () => this.layout(), dom.getWindow(host.parent), { resizeObserverCtor }));
		this._register(dom.addDisposableListener(this.image, 'load', () => {
			this.loaded = true;
			this.layout();
		}));
		this._register(dom.addDisposableListener(this.image, 'error', () => {
			this.loaded = false;
			this.layout();
			logService.error('[ChatPetReplacementWidget] Failed to load replacement character');
		}));
		const ownership = this._register(new ChatPetWindowOwnership(dom.getWindow(host.parent), hostService));
		const hidden = observableFromEvent(this, entitlementService.onDidChangeSentiment, () => !!entitlementService.sentiment.hidden);
		this.setHost(host);
		this._register(autorun(reader => {
			this.visible = chatPetService.enabled.read(reader) && ownership.active.read(reader) && !hidden.read(reader);
			this.layout();
		}));
		this.image.src = FileAccess.asBrowserUri('vs/sessions/contrib/chat/browser/media/chatPetReplacement/idle.png').toString(true);
	}

	setHost(host: IChatPetWidgetHost): void {
		this.hostStore.clear();
		this.host.setPlatformOccupation?.(undefined);
		this.host.parent.classList.remove('chat-pet-host');
		this.host = host;
		host.parent.classList.add('chat-pet-host');
		host.parent.prepend(this.overlay);
		this.hostStore.add(this.resizeObserver.observe(host.parent));
		this.hostStore.add(this.resizeObserver.observe(host.dragBounds));
		this.hostStore.add(this.resizeObserver.observe(host.movementBounds));
		this.hostStore.add(host.onDidChangePlatform(() => this.layout()));
		this.layout();
	}

	private layout(): void {
		const host = this.host;
		const input = host.dragBounds.getBoundingClientRect();
		const visible = this.visible && this.loaded && host.parent.isConnected && input.width > 0 && input.height > 0;
		this.overlay.hidden = !visible;
		if (!visible) {
			host.setPlatformOccupation?.(undefined);
			return;
		}
		const origin = this.overlay.getBoundingClientRect();
		const left = getChatPetDefaultHorizontalPosition(input.left, Math.max(input.left, input.right - displaySize));
		const centerX = left + displaySize / 2;
		const top = host.getPlatformTop(centerX) ?? input.top;
		this.image.style.left = `${left - origin.left}px`;
		this.image.style.top = `${top - origin.top - displaySize}px`;
		host.setPlatformOccupation?.({ centerX, top, width: displaySize });
	}
}
