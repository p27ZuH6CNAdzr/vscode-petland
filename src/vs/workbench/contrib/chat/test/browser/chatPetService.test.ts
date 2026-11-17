/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as DOM from '../../../../../base/browser/dom.js';
import { setARIAContainer } from '../../../../../base/browser/ui/aria/aria.js';
import { toDisposable } from '../../../../../base/common/lifecycle.js';
import { mainWindow } from '../../../../../base/browser/window.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { mock } from '../../../../../base/test/common/mock.js';
import { NullLogService } from '../../../../../platform/log/common/log.js';
import { NullTelemetryServiceShape } from '../../../../../platform/telemetry/common/telemetryUtils.js';
import { TestStorageService } from '../../../../test/common/workbenchTestServices.js';
import { IWorkbenchEnvironmentService } from '../../../../services/environment/common/environmentService.js';
import { ChatPetService } from '../../browser/chatPetService.js';

suite('ChatPetService', () => {
	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	test('announces supported interactions only for the editor-window pet', () => {
		const ariaHost = DOM.$('div');
		mainWindow.document.body.append(ariaHost);
		disposables.add(toDisposable(() => {
			ariaHost.remove();
			setARIAContainer(mainWindow.document.body);
		}));
		setARIAContainer(ariaHost);

		const editorService = disposables.add(new ChatPetService(
			disposables.add(new TestStorageService()),
			new NullTelemetryServiceShape(),
			new NullLogService(),
			new class extends mock<IWorkbenchEnvironmentService>() { override readonly isSessionsWindow = false; }(),
		));
		const agentsService = disposables.add(new ChatPetService(
			disposables.add(new TestStorageService()),
			new NullTelemetryServiceShape(),
			new NullLogService(),
			new class extends mock<IWorkbenchEnvironmentService>() { override readonly isSessionsWindow = true; }(),
		));

		const announcements = () => [...ariaHost.querySelectorAll<HTMLElement>('.monaco-status')]
			.map(element => element.textContent)
			.filter((message): message is string => !!message);
		editorService.toggle();
		const editorAnnouncement = announcements();
		agentsService.toggle();
		const agentsAnnouncement = announcements();

		assert.deepStrictEqual([editorAnnouncement, agentsAnnouncement], [
			['VS Code pet enabled. Click the pet to interact with it, or use the Left and Right Arrow keys to move it.'],
			['VS Code pet enabled.'],
		]);
	});
});
