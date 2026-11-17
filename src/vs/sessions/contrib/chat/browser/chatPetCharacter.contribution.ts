/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { status } from '../../../../base/browser/ui/aria/aria.js';
import { localize, localize2 } from '../../../../nls.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IQuickInputService, IQuickPickItem } from '../../../../platform/quickinput/common/quickInput.js';
import { IsSessionsWindowContext } from '../../../../workbench/common/contextkeys.js';
import { CHAT_CATEGORY } from '../../../../workbench/contrib/chat/browser/actions/chatActions.js';
import { IChatPetWidgetService } from '../../../../workbench/contrib/chat/browser/widget/chatPetWidgetService.js';
import { ChatContextKeys } from '../../../../workbench/contrib/chat/common/actions/chatContextKeys.js';
import { IChatEntitlementService } from '../../../../workbench/services/chat/common/chatEntitlementService.js';
import { IWorkbenchEnvironmentService } from '../../../../workbench/services/environment/common/environmentService.js';
import { ChatPetCharacter, ISessionsChatPetCharacterService, SessionsChatPetCharacterService } from './chatPetCharacter.js';
import { SessionsChatPetWidgetService } from './sessionsChatPetWidgetService.js';

registerSingleton(ISessionsChatPetCharacterService, SessionsChatPetCharacterService, InstantiationType.Delayed);
registerSingleton(IChatPetWidgetService, SessionsChatPetWidgetService, InstantiationType.Delayed);

export class SelectChatPetCharacterAction extends Action2 {
	constructor() {
		super({
			id: 'sessions.chatPet.selectCharacter',
			title: localize2('chatPet.selectCharacter', "Select Pet Character"),
			category: CHAT_CATEGORY,
			f1: true,
			precondition: ContextKeyExpr.and(IsSessionsWindowContext, ChatContextKeys.enabled),
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const entitlement = accessor.get(IChatEntitlementService);
		if (!accessor.get(IWorkbenchEnvironmentService).isSessionsWindow || entitlement.sentiment.hidden) {
			return;
		}
		const service = accessor.get(ISessionsChatPetCharacterService);
		const items: (IQuickPickItem & { readonly character: ChatPetCharacter })[] = [
			{ label: localize('chatPet.character.blobby', "Blobby"), character: 'blobby' },
			{ label: localize('chatPet.character.replacement', "Replacement"), character: 'replacement', description: localize('chatPet.character.placeholder', "Static placeholder; no interactions") },
		];
		const selected = await accessor.get(IQuickInputService).pick(items, {
			placeHolder: localize('chatPet.character.choose', "Select the pet character for the Agents window"),
			activeItem: items.find(item => item.character === service.character.get()),
		});
		if (selected && !entitlement.sentiment.hidden) {
			service.setCharacter(selected.character);
			status(localize('chatPet.character.selected', "Agents window pet character: {0}", selected.label));
		}
	}
}

registerAction2(SelectChatPetCharacterAction);
