import * as React from 'react';
import { render, fireEvent, act } from './test-utils';
import { axe } from 'jest-axe';

import { Tooltip, LEAVE_TIMEOUT, REST_TIMEOUT } from '../src/index';

////////////////////////////////////////////////////////////////////////////////

function leaveTooltip(element) {
	fireEvent.mouseLeave(element);
	jest.advanceTimersByTime(LEAVE_TIMEOUT);
}

function blurTooltip(element) {
	fireEvent.blur(element);
	jest.advanceTimersByTime(LEAVE_TIMEOUT);
}

function focusTooltip(element) {
	fireEvent.focus(element);
	jest.advanceTimersByTime(REST_TIMEOUT);
}

function mouseoverTooltip(element) {
	fireEvent.mouseOver(element);
	jest.advanceTimersByTime(REST_TIMEOUT);
}

////////////////////////////////////////////////////////////////////////////////

describe('<Tooltip />', () => {
	beforeEach(() => {
		jest.useFakeTimers();
	});

	it('should not have ARIA violations', async () => {
		let { container, getByText } = render(
			<div data-testid="tooltip">
				<Tooltip label="Content">
					<button>Trigger</button>
				</Tooltip>
			</div>,
		);

		const trigger = getByText(/trigger/i);

		// NOTE(joel): jest-axe needs real timers
		jest.useRealTimers();
		await expect(container).toHaveNoAxeViolations();
		jest.useFakeTimers();

		act(() => void mouseoverTooltip(trigger));

		jest.useRealTimers();
		await expect(container).toHaveNoAxeViolations();
		jest.useFakeTimers();

		act(() => void leaveTooltip(trigger));
	});

	it('should show/hide a tooltip on hover', () => {
		const tooltipText = "I'm the tooltip!";
		const { getByText, queryByText } = render(
			<p>
				<Tooltip label={tooltipText}>
					<span>Trigger</span>
				</Tooltip>
			</p>,
		);

		const trigger = getByText(/trigger/i);

		act(() => void mouseoverTooltip(trigger));
		expect(queryByText(tooltipText)).toBeTruthy();

		act(() => void blurTooltip(trigger));
		expect(queryByText(tooltipText)).toBeFalsy();

		act(() => void leaveTooltip(trigger));
	});

	it('should show/hide a tooltip when trigger is focused/blurred', () => {
		const tooltipText = "I'm the tooltip!";
		const { getByText, queryByText } = render(
			<Tooltip label={tooltipText}>
				<button>Trigger</button>
			</Tooltip>,
		);

		const trigger = getByText(/trigger/i);
		expect(queryByText(tooltipText)).toBeFalsy();

		act(() => void focusTooltip(trigger));
		expect(queryByText(tooltipText)).toBeTruthy();

		act(() => void blurTooltip(trigger));
		expect(queryByText(tooltipText)).toBeFalsy();

		act(() => void leaveTooltip(trigger));
	});

	it('should render as any HTML element', () => {
		const tooltipText = "I'm the tooltip!";
		const { getByText } = render(
			<p>
				<Tooltip as="span" label={tooltipText}>
					<span>Trigger</span>
				</Tooltip>
			</p>,
		);

		const trigger = getByText(/trigger/i);
		act(() => void mouseoverTooltip(trigger));

		const tooltip = getByText(tooltipText);
		expect(tooltip.tagName).toBe('SPAN');

		act(() => void leaveTooltip(trigger));
	});

	it('should render with proper default CSS', () => {
		const tooltipText = "I'm the tooltip!";
		const { getByText } = render(
			<p>
				<Tooltip as="span" label={tooltipText}>
					<span>Trigger</span>
				</Tooltip>
			</p>,
		);

		const trigger = getByText(/trigger/i);
		act(() => void mouseoverTooltip(trigger));

		const style = getComputedStyle(getByText(tooltipText));
		expect({
			position: style.position,
			pointerEvents: style.pointerEvents,
			zIndex: style.zIndex,
			whiteSpace: style.whiteSpace,
			backgroundColor: style.backgroundColor,
			border: style.border,
		}).toEqual({
			position: 'absolute',
			pointerEvents: 'none',
			zIndex: '1',
			whiteSpace: 'nowrap',
			backgroundColor: 'white',
			border: '1px solid #ccc',
		});

		act(() => void leaveTooltip(trigger));
	});

	it('should show a tooltip w/o timeout when another tooltip is already visible', () => {
		let { getByText, queryByText } = render(
			<>
				<Tooltip label="First">
					<button>First Trigger</button>
				</Tooltip>
				<Tooltip label="Second">
					<button>Second Trigger</button>
				</Tooltip>
			</>,
		);

		let firstTrigger = getByText(/first trigger/i);
		let secondTrigger = getByText(/second trigger/i);

		act(() => void mouseoverTooltip(firstTrigger));

		expect(queryByText(/^first$/i)).toBeTruthy();

		act(() => {
			fireEvent.mouseLeave(firstTrigger);
			fireEvent.mouseOver(secondTrigger);
		});

		expect(queryByText(/^second$/i)).toBeTruthy();

		act(() => void leaveTooltip(secondTrigger));
	});

	it('should hide on ESC', () => {
		const tooltipText = "I'm the tooltip!";
		const { getByText, queryByText } = render(
			<Tooltip label={tooltipText}>
				<button>Trigger</button>
			</Tooltip>,
		);

		const trigger = getByText(/trigger/i);

		act(() => void focusTooltip(trigger));
		expect(queryByText(tooltipText)).toBeTruthy();

		act(() => void fireEvent.keyDown(trigger, { key: 'Escape' }));
		expect(queryByText(tooltipText)).toBeFalsy();

		act(() => void leaveTooltip(trigger));
	});
});
