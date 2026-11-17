/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as dom from '../../../../base/browser/dom.js';
import { Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { IObservable } from '../../../../base/common/observable.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IChatWidgetService } from '../../../../workbench/contrib/chat/browser/chat.js';
import { ChatPetWidget, IChatPetWidgetHost } from '../../../../workbench/contrib/chat/browser/widget/chatPetWidget.js';
import { ChatPetWidgetCoordinator, IChatPetWidgetHostRegistration, IChatPetWidgetService } from '../../../../workbench/contrib/chat/browser/widget/chatPetWidgetService.js';
import { ISessionsChatPetCharacterService, SessionsChatPetCharacterWidget } from './chatPetCharacter.js';
import { ChatPetReplacementWidget } from './chatPetReplacementWidget.js';

export class SessionsChatPetWidgetService extends Disposable implements IChatPetWidgetService {
	declare readonly _serviceBrand: undefined;
	private readonly coordinator;

	constructor(
		@IInstantiationService instantiationService: IInstantiationService,
		@IChatWidgetService chatWidgetService: IChatWidgetService,
		@ISessionsChatPetCharacterService characterService: ISessionsChatPetCharacterService,
	) {
		super();
		this.coordinator = this._register(new ChatPetWidgetCoordinator(
			host => new SessionsChatPetCharacterWidget(host, characterService.character, (character, currentHost) => character === 'replacement'
				? instantiationService.createInstance(ChatPetReplacementWidget, currentHost, undefined)
				: instantiationService.createInstance(ChatPetWidget, currentHost, undefined)),
			chatWidgetService,
			Event.map(dom.onWillUnregisterWindow, window => dom.getWindowId(window)),
		));
	}

	register(owner: object, host: IChatPetWidgetHost, preferred?: IObservable<boolean>, onDidFocus?: Event<void>): IChatPetWidgetHostRegistration {
		return this.coordinator.register(owner, host, preferred, onDidFocus);
	}

	getFocusedJumpGame() {
		return this.coordinator.getFocusedJumpGame();
	}
}
