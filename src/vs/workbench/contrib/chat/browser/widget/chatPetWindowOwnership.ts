/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { BroadcastDataChannel } from '../../../../../base/browser/broadcast.js';
import * as dom from '../../../../../base/browser/dom.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { IObservable, observableValue } from '../../../../../base/common/observable.js';
import { IHostService } from '../../../../services/host/browser/host.js';

export const CHAT_PET_WINDOW_OWNERSHIP_CHANNEL = 'vscode-chat-pet-window-ownership';

export function isChatPetWindowActive(activeWindowId: number, targetWindowId: number): boolean {
	return activeWindowId === targetWindowId;
}

export function shouldClaimChatPetWindowOnConstruction(windowActive: boolean, documentFocused: boolean): boolean {
	return windowActive && documentFocused;
}

export class ChatPetWindowOwnership extends Disposable {
	readonly active: IObservable<boolean>;

	constructor(
		targetWindow: Window,
		@IHostService hostService: IHostService,
	) {
		super();
		const targetWindowId = dom.getWindowId(targetWindow);
		const active = observableValue(this, isChatPetWindowActive(dom.getWindowId(dom.getActiveWindow()), targetWindowId));
		this.active = active;
		const channel = this._register(new BroadcastDataChannel<{ readonly windowId: number }>(CHAT_PET_WINDOW_OWNERSHIP_CHANNEL));
		this._register(channel.onDidReceiveData(({ windowId }) => {
			active.set(isChatPetWindowActive(windowId, targetWindowId), undefined);
		}));
		const claim = () => {
			active.set(true, undefined);
			channel.postData({ windowId: targetWindowId });
		};
		this._register(dom.addDisposableListener(targetWindow, dom.EventType.FOCUS, claim));
		this._register(hostService.onDidChangeActiveWindow(windowId => {
			if (isChatPetWindowActive(windowId, targetWindowId)) {
				claim();
			} else {
				active.set(false, undefined);
			}
		}));
		if (shouldClaimChatPetWindowOnConstruction(active.get(), targetWindow.document.hasFocus())) {
			claim();
		}
	}
}
