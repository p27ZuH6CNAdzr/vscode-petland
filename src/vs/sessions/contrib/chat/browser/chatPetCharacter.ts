/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, MutableDisposable } from '../../../../base/common/lifecycle.js';
import { autorun, IObservable, observableValue } from '../../../../base/common/observable.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { IChatPetWidgetHost } from '../../../../workbench/contrib/chat/browser/widget/chatPetWidget.js';
import { IChatPetWidgetInstance } from '../../../../workbench/contrib/chat/browser/widget/chatPetWidgetService.js';

export type ChatPetCharacter = 'blobby' | 'replacement';

export const ISessionsChatPetCharacterService = createDecorator<ISessionsChatPetCharacterService>('sessionsChatPetCharacterService');

export interface ISessionsChatPetCharacterService {
	readonly _serviceBrand: undefined;
	readonly character: IObservable<ChatPetCharacter>;
	setCharacter(character: ChatPetCharacter): void;
}

const characterStorageKey = 'sessions.chatPet.character';

export class SessionsChatPetCharacterService extends Disposable implements ISessionsChatPetCharacterService {
	declare readonly _serviceBrand: undefined;
	private readonly selectedCharacter;
	readonly character: IObservable<ChatPetCharacter>;

	constructor(
		@IStorageService private readonly storageService: IStorageService,
		@ILogService private readonly logService: ILogService,
	) {
		super();
		this.selectedCharacter = observableValue(this, this.readCharacter());
		this.character = this.selectedCharacter;
		this._register(storageService.onDidChangeValue(StorageScope.APPLICATION, characterStorageKey, this._store)(() => {
			this.selectedCharacter.set(this.readCharacter(), undefined);
		}));
	}

	setCharacter(character: ChatPetCharacter): void {
		if (character !== 'blobby' && character !== 'replacement') {
			throw new Error(`Invalid chat pet character: ${character}`);
		}
		this.storageService.store(characterStorageKey, character, StorageScope.APPLICATION, StorageTarget.MACHINE);
		this.selectedCharacter.set(character, undefined);
	}

	private readCharacter(): ChatPetCharacter {
		const stored = this.storageService.get(characterStorageKey, StorageScope.APPLICATION);
		if (stored === undefined || stored === 'blobby') {
			return 'blobby';
		}
		if (stored === 'replacement') {
			return stored;
		}
		this.logService.warn('[SessionsChatPetCharacterService] Invalid stored character; using Blobby');
		return 'blobby';
	}
}

export class SessionsChatPetCharacterWidget extends Disposable implements IChatPetWidgetInstance {
	private readonly widget = this._register(new MutableDisposable<IChatPetWidgetInstance>());

	get jumpGame() {
		return this.widget.value?.jumpGame;
	}

	constructor(
		private host: IChatPetWidgetHost,
		character: IObservable<ChatPetCharacter>,
		createWidget: (character: ChatPetCharacter, host: IChatPetWidgetHost) => IChatPetWidgetInstance,
	) {
		super();
		this._register(autorun(reader => {
			const selected = character.read(reader);
			this.widget.clear();
			this.widget.value = createWidget(selected, this.host);
		}));
	}

	setHost(host: IChatPetWidgetHost): void {
		this.host = host;
		this.widget.value?.setHost(host);
	}
}
