import { useId } from '@react-lit/auto-id';
import {
	getDocumentDimensions,
	getOwnerDocument,
	makeId,
	useComposeRefs,
	composeEventHandlers,
} from '@react-lit/helper';
import { Portal } from '@react-lit/portal';
import { VisuallyHidden } from '@react-lit/visually-hidden';
import { useRect } from '@react-lit/rect';
import {
	Children,
	cloneElement,
	forwardRef,
	useEffect,
	useRef,
	useState,
} from 'react';

////////////////////////////////////////////////////////////////////////////////

/**
 * @typedef {Object} TooltipStates
 * @prop {string} IDLE
 * @prop {string} FOCUSED
 * @prop {string} VISIBLE
 * @prop {string} LEAVINGVISIBLE
 * @prop {string} DISMISSED
 */
const TooltipStates = {
	IDLE: 'IDLE',
	FOCUSED: 'FOCUSED',
	VISIBLE: 'VISIBLE',
	LEAVINGVISIBLE: 'LEAVING_VISIBLE',
	DISMISSED: 'DISMISSED',
};

////////////////////////////////////////////////////////////////////////////////

/**
 * @typedef {Object} TooltipEvents
 * @prop {string} BLUR
 * @prop {string} FOCUS
 * @prop {string} GLOBALMOUSEMOVE
 * @prop {string} MOUSEDOWN
 * @prop {string} MOUSEENTER
 * @prop {string} MOUSELEAVE
 * @prop {string} MOUSEMOVE
 * @prop {string} REST
 * @prop {string} SELECTWITHKEYBOARD
 * @prop {string} TIMECOMPLETE
 */
const TooltipEvents = {
	BLUR: 'BLUR',
	FOCUS: 'FOCUS',
	GLOBALMOUSEMOVE: 'GLOBAL_MOUSE_MOVE',
	MOUSEDOWN: 'MOUSE_DOWN',
	MOUSEENTER: 'MOUSE_ENTER',
	MOUSELEAVE: 'MOUSE_LEAVE',
	MOUSEMOVE: 'MOUSE_MOVE',
	REST: 'REST',
	SELECTWITHKEYBOARD: 'SELECT_WITH_KEYBOARD',
	TIMECOMPLETE: 'TIME_COMPLETE',
};

/** @typedef {keyof typeof TooltipStates} TooltipState */
/** @typedef {keyof typeof TooltipEvents} TooltipEvent */

////////////////////////////////////////////////////////////////////////////////

/**
 * @typedef {Object} StateContext
 * @prop {string?} [id]
 */

/**
 * @typedef {Object} MachineEvent
 * @prop {TooltipEvent} type
 * @prop {string?} [id]
 */

/**
 * @typedef {(context: StateContext, event: MachineEvent) => void} ActionFunction
 */

/**
 * @typedef {Object} StateChart
 * @prop {TooltipState} initial
 * @prop {{[key in TooltipState]: {enter?: ActionFunction, leave?: ActionFunction, on: {[key in TooltipEvent]: TooltipState}}}} states
 */

const chart = {
	initial: TooltipStates.IDLE,
	states: {
		[TooltipStates.IDLE]: {
			enter: clearContextId,
			on: {
				[TooltipEvents.MOUSEENTER]: TooltipStates.FOCUSED,
				[TooltipEvents.FOCUS]: TooltipStates.VISIBLE,
			},
		},
		[TooltipStates.FOCUSED]: {
			enter: startRestTimer,
			leave: clearRestTimer,
			on: {
				[TooltipEvents.MOUSEMOVE]: TooltipStates.FOCUSED,
				[TooltipEvents.MOUSELEAVE]: TooltipStates.IDLE,
				[TooltipEvents.MOUSEDOWN]: TooltipStates.DISMISSED,
				[TooltipEvents.BLUR]: TooltipStates.IDLE,
				[TooltipEvents.REST]: TooltipStates.VISIBLE,
			},
		},
		[TooltipStates.VISIBLE]: {
			on: {
				[TooltipEvents.FOCUS]: TooltipStates.FOCUSED,
				[TooltipEvents.MOUSEENTER]: TooltipStates.FOCUSED,
				[TooltipEvents.MOUSELEAVE]: TooltipStates.LEAVINGVISIBLE,
				[TooltipEvents.BLUR]: TooltipStates.LEAVINGVISIBLE,
				[TooltipEvents.MOUSEDOWN]: TooltipStates.DISMISSED,
				[TooltipEvents.SELECTWITHKEYBOARD]: TooltipStates.DISMISSED,
				[TooltipEvents.GLOBALMOUSEMOVE]: TooltipStates.LEAVINGVISIBLE,
			},
		},
		[TooltipStates.LEAVINGVISIBLE]: {
			enter: startLeavingVisibleTimer,
			leave: () => {
				clearLeavingVisibleTimer();
				clearContextId();
			},
			on: {
				[TooltipEvents.MOUSEENTER]: TooltipStates.VISIBLE,
				[TooltipEvents.FOCUS]: TooltipStates.VISIBLE,
				[TooltipEvents.TIMECOMPLETE]: TooltipStates.IDLE,
			},
		},
		[TooltipStates.DISMISSED]: {
			leave: () => {
				clearContextId();
			},
			on: {
				[TooltipEvents.MOUSELEAVE]: TooltipStates.IDLE,
				[TooltipEvents.BLUR]: TooltipStates.IDLE,
			},
		},
	},
};

////////////////////////////////////////////////////////////////////////////////

/**
 * Global state used by the state chart.
 * @type {{value: TooltipStates, context: StateContext}}
 */
let state = {
	value: chart.initial,
	context: { id: null },
};

////////////////////////////////////////////////////////////////////////////////

/**
 * clearContextId clears the current tootlip id inside our global state context.
 * This allows us to come on back later w/o entering something else first after
 * the user leaves or dismisses.
 */
function clearContextId() {
	state.context.id = null;
}

////////////////////////////////////////////////////////////////////////////////

// NOTE(joel): Instead if requiring a wrapping <TooltipProvider> and use React
// context to notify single tooltips on changes, we manage subscriptions
// ourselves.

/** @type {Function[]} */
let subscriptions = [];

/**
 * subscribe adds `fn` to the list of subscriptions. It returns a clean-up
 * function to remove `fn`.
 * @param {Function} fn
 * @returns {() => void}
 */
function subscribe(fn) {
	subscriptions.push(fn);
	return () => {
		subscriptions.splice(subscriptions.indexOf(fn), 1);
	};
}

/**
 * notify iterates through the list of subscriptions and calls each listener
 * with the current global `state`.
 */
function notify() {
	subscriptions.forEach(fn => fn(state));
}

////////////////////////////////////////////////////////////////////////////////

/**
 * @typedef {Object} StateObject
 * @prop {TooltipState} value
 * @prop {StateContext} context
 */

/**
 * transition gets the next state from our state maschine and calls associated
 * `leave` and `enter` actions.
 * @param {StateObject} currentState
 * @param {MachineEvent} event
 * @returns {StateObject & { changed: boolean }}
 */
function transition(currentState, event) {
	const stateDef = chart.states[currentState.value];
	const nextState = stateDef?.on?.[event.type];

	// DEBUG
	// console.log({ event, state, nextState, contextId: context.id });
	// !nextState && console.log("no transition taken");

	if (!nextState) return { ...currentState, changed: false };

	if (stateDef && stateDef.leave) {
		stateDef.leave(currentState.context, event);
	}

	const { type: _, ...payload } = event;
	const context = { ...state.context, ...payload };

	const nextStateValue =
		typeof nextState === 'string' ? nextState : nextState.target;
	const nextDef = chart.states[nextStateValue];
	if (nextDef && nextDef.enter) {
		nextDef.enter(currentState.context, event);
	}

	return {
		value: nextStateValue,
		context,
		changed: true,
	};
}

/**
 * send sends an event to our state machine to find the next state from
 * the current state + action. It also manages lifecycles of the machine
 * (e.g. enter/leave hooks on the state chart).
 * @param {MachineEvent} event
 */
function send(event) {
	let { value, context, changed } = transition(state, event);
	if (changed) {
		state = { value, context };
		notify();
	}
}

////////////////////////////////////////////////////////////////////////////////

export const REST_TIMEOUT = 100;

/** @type {number} */
let restTimeout;

/**
 * startRestTimer manages the delay before the tooltip enters the rest state.
 */
function startRestTimer() {
	window.clearTimeout(restTimeout);
	restTimeout = window.setTimeout(() => {
		send({ type: TooltipEvents.REST });
	}, REST_TIMEOUT);
}

/**
 * clearRestTimer clears the timeout that manages the delay before the tooltip
 * enters the rest state.
 */
function clearRestTimer() {
	window.clearTimeout(restTimeout);
}

////////////////////////////////////////////////////////////////////////////////

export const LEAVE_TIMEOUT = 500;

/** @type {number} */
let leavingVisibleTimer;

/**
 * startLeavingVisibleTimer manages the delay to hide the tooltip after
 * rest leaves.
 */
function startLeavingVisibleTimer() {
	window.clearTimeout(leavingVisibleTimer);
	leavingVisibleTimer = window.setTimeout(
		() => send({ type: TooltipEvents.TIMECOMPLETE }),
		LEAVE_TIMEOUT,
	);
}

/**
 * clearLeavingVisibleTimer clears the timeout that manages the delay to hide
 * the tooltip after rest leaves.
 */
function clearLeavingVisibleTimer() {
	window.clearTimeout(leavingVisibleTimer);
}

////////////////////////////////////////////////////////////////////////////////

/**
 * isTooltipVisible
 * @param {string} id
 * @param {boolean} [initial]
 */
function isTooltipVisible(id, initial) {
	return (
		state.context.id === id &&
		(initial
			? state.value === TooltipStates.VISIBLE
			: state.value === TooltipStates.VISIBLE ||
			  state.value === TooltipStates.LEAVINGVISIBLE)
	);
}

////////////////////////////////////////////////////////////////////////////////

/**
 * useTooltip
 * @param {Object} [params={}]
 * @param {string} [params.id]
 * @param {React.ReactEventHandler} [params.onPointerEnter]
 * @param {React.ReactEventHandler} [params.onPointerMove]
 * @param {React.ReactEventHandler} [params.onPointerLeave]
 * @param {React.ReactEventHandler} [params.onPointerDown]
 * @param {React.ReactEventHandler} [params.onMouseEnter]
 * @param {React.ReactEventHandler} [params.onMouseMove]
 * @param {React.ReactEventHandler} [params.onMouseLeave]
 * @param {React.ReactEventHandler} [params.onMouseDown]
 * @param {React.ReactEventHandler} [params.onFocus]
 * @param {React.ReactEventHandler} [params.onBlur]
 * @param {React.ReactEventHandler} [params.onKeyDown]
 * @param {boolean} [params.disabled]
 * @param {React.Ref<T>} [params.ref]
 * @template T
 */
export function useTooltip({
	id: idProp,
	onPointerEnter,
	onPointerMove,
	onPointerLeave,
	onPointerDown,
	onMouseEnter,
	onMouseMove,
	onMouseLeave,
	onMouseDown,
	onFocus,
	onBlur,
	onKeyDown,
	disabled,
	ref: parentRef,
}) {
	const id = String(useId(idProp));
	const [isVisible, setIsVisible] = useState(isTooltipVisible(id, true));

	const ownRef = useRef();
	const ref = useComposeRefs(parentRef, ownRef);
	const triggerRect = useRect(ownRef, { observe: isVisible });

	// Subscribe to global state changes of our state machine
	useEffect(
		() =>
			subscribe(() => {
				setIsVisible(isTooltipVisible(id));
			}),
		[id],
	);

	useEffect(() => {
		let ownerDocument = getOwnerDocument(ownRef.current);
		/**
		 * @param {KeyboardEvent} event
		 */
		function listener(event) {
			if (
				(event.key === 'Escape' || event.key === 'Esc') &&
				state.value === TooltipStates.VISIBLE
			) {
				send({ type: TooltipEvents.SELECTWITHKEYBOARD });
			}
		}
		ownerDocument.addEventListener('keydown', listener);
		return () => ownerDocument.removeEventListener('keydown', listener);
	}, []);

	useDisabledTriggerOnSafari({ disabled, isVisible, ref: ownRef });

	function wrapMouseEvent(theirHandler, ourHandler) {
		// NOTE(joel): Use internal MouseEvent handler only if PointerEvent is not
		// supported
		if (typeof window !== 'undefined' && 'PointerEvent' in window) {
			return theirHandler;
		}
		return composeEventHandlers(theirHandler, ourHandler);
	}

	function wrapPointerEventHandler(handler) {
		return function onPointerEvent(event) {
			// NOTE(joel): Handle pointer events only from mouse device.
			if (event.pointerType !== 'mouse') return;
			handler(event);
		};
	}

	function handleMouseEnter() {
		send({ type: TooltipEvents.MOUSEENTER, id });
	}

	function handleMouseMove() {
		send({ type: TooltipEvents.MOUSEMOVE, id });
	}

	function handleMouseLeave() {
		send({ type: TooltipEvents.MOUSELEAVE });
	}

	function handleMouseDown() {
		// NOTE(joel): Allow quick click from one tool to another.
		if (state.context.id === id) {
			send({ type: TooltipEvents.MOUSEDOWN });
		}
	}

	function handleFocus() {
		send({ type: TooltipEvents.FOCUS, id });
	}

	function handleBlur() {
		// NOTE(joel): Allow quick click from one tool to another
		if (state.context.id === id) {
			send({ type: TooltipEvents.BLUR });
		}
	}

	function handleKeyDown(event) {
		if (event.key === 'Enter' || event.key === ' ') {
			send({ type: TooltipEvents.SELECTWITHKEYBOARD });
		}
	}

	let trigger = {
		// NOTE(joel): The element that triggers the tooltip references the
		// tooltip element with `aria-describedby`.
		// @see https://www.w3.org/TR/wai-aria-practices-1.2/#tooltip
		'aria-describedby': isVisible ? makeId('tooltip', id) : undefined,
		'data-state': isVisible ? 'tooltip-visible' : 'tooltip-hidden',
		'data-react-lit-tooltip-trigger': '',
		ref,
		onPointerEnter: composeEventHandlers(
			onPointerEnter,
			wrapPointerEventHandler(handleMouseEnter),
		),
		onPointerMove: composeEventHandlers(
			onPointerMove,
			wrapPointerEventHandler(handleMouseMove),
		),
		onPointerLeave: composeEventHandlers(
			onPointerLeave,
			wrapPointerEventHandler(handleMouseLeave),
		),
		onPointerDown: composeEventHandlers(
			onPointerDown,
			wrapPointerEventHandler(handleMouseDown),
		),
		onMouseEnter: wrapMouseEvent(onMouseEnter, handleMouseEnter),
		onMouseMove: wrapMouseEvent(onMouseMove, handleMouseMove),
		onMouseLeave: wrapMouseEvent(onMouseLeave, handleMouseLeave),
		onMouseDown: wrapMouseEvent(onMouseDown, handleMouseDown),
		onFocus: composeEventHandlers(onFocus, handleFocus),
		onBlur: composeEventHandlers(onBlur, handleBlur),
		onKeyDown: composeEventHandlers(onKeyDown, handleKeyDown),
	};

	const tooltip = { id, triggerRect, isVisible };
	return [trigger, tooltip, isVisible];
}

////////////////////////////////////////////////////////////////////////////////

/**
 * Tooltip
 */
export const Tooltip = forwardRef(
	({ children, label, id, ...props }, parentRef) => {
		let child = Children.only(children);

		// NOTE(joel): Pass some child props to useTooltip to allow control over
		// the trigger's ref and events.
		let [trigger, tooltip] = useTooltip({
			id,
			onPointerEnter: child.props.onPointerEnter,
			onPointerMove: child.props.onPointerMove,
			onPointerLeave: child.props.onPointerLeave,
			onPointerDown: child.props.onPointerDown,
			onMouseEnter: child.props.onMouseEnter,
			onMouseMove: child.props.onMouseMove,
			onMouseLeave: child.props.onMouseLeave,
			onMouseDown: child.props.onMouseDown,
			onFocus: child.props.onFocus,
			onBlur: child.props.onBlur,
			onKeyDown: child.props.onKeyDown,
			disabled: child.props.disabled,
			ref: child.ref,
		});

		return (
			<>
				{cloneElement(child, trigger)}
				<TooltipPopup ref={parentRef} label={label} {...tooltip} {...props} />
			</>
		);
	},
);

////////////////////////////////////////////////////////////////////////////////

/**
 * TooltipPopup
 */
export const TooltipPopup = forwardRef(
	(
		{
			// could use children but we want to encourage simple strings
			label,
			isVisible,
			id,
			...props
		},
		parentRef,
	) =>
		isVisible ? (
			<Portal>
				<TooltipContent
					ref={parentRef}
					label={label}
					isVisible={isVisible}
					{...props}
					id={makeId('tooltip', String(id))}
				/>
			</Portal>
		) : null,
);

////////////////////////////////////////////////////////////////////////////////

/**
 * TooltipContent renders a seperate component so that `useRect` works inside
 * the <Portal />
 */
export const TooltipContent = forwardRef(
	(
		{
			'aria-label': ariaLabel,
			as: Comp = 'div',
			id,
			isVisible,
			label,
			position = positionTooltip,
			style,
			triggerRect,
			...props
		},
		parentRef,
	) => {
		// NOTE(joel): When an app passes an `aria-label`, we actually want to
		// implement `role="tooltip"` on a visually hidden element inside of
		// the trigger. In these cases we want the screen reader user to know both
		// the content in the tooltip, but also the content in the badge. For
		// screen reader users, the only content announced to them is whatever is
		// in the tooltip.
		// @see https://www.w3.org/TR/wai-aria-practices-1.2/#tooltip
		const hasAriaLabel = ariaLabel != null;

		const ownRef = useRef();
		const ref = useComposeRefs(parentRef, ownRef);
		const tooltipRect = useRect(ownRef, { observe: isVisible });

		return (
			<>
				<Comp
					{...props}
					role={hasAriaLabel ? undefined : 'tooltip'}
					ref={ref}
					id={hasAriaLabel ? undefined : id}
					style={{
						position: 'absolute',
						pointerEvents: 'none',
						zIndex: 1,
						whiteSpace: 'nowrap',
						backgroundColor: 'white',
						border: '1px solid #ccc',
						...style,
						...getStyles(position, triggerRect, tooltipRect),
					}}
					data-react-lit-tooltip=""
				>
					{label}
				</Comp>
				{hasAriaLabel && (
					<VisuallyHidden role="tooltip" id={id}>
						{ariaLabel}
					</VisuallyHidden>
				)}
			</>
		);
	},
);

////////////////////////////////////////////////////////////////////////////////

/**
 * @typedef {(targetRect: Partial<DOMRect>?, popoverRect: Partial<DOMRect>?) => React.CSSProperties} Position
 */

/**
 * getStyles returns the styles object for the <TooltipContent> component.
 * @param {Position} position
 * @param {Partial<DOMRect>} triggerRect
 * @param {Partial<DOMRect>} tooltipRect
 * @returns {React.CSSProperties}
 */
function getStyles(position, triggerRect, tooltipRect) {
	const haventMeasuredTooltipYet = !tooltipRect;
	if (haventMeasuredTooltipYet) {
		return { visibility: 'hidden' };
	}
	return position(triggerRect, tooltipRect);
}

////////////////////////////////////////////////////////////////////////////////

/**
 * positionTooltip calculates the tooltip's top and left position in px.
 * @param {Partial<DOMRect>} triggerRect
 * @param {Partial<DOMRect>} tooltipRect
 * @param {number} [offset=8]
 * @returns {Position}
 */
export const positionTooltip = (triggerRect, tooltipRect, offset = 8) => {
	const { width: windowWidth, height: windowHeight } = getDocumentDimensions();
	if (!triggerRect || !tooltipRect) return {};

	const collisions = {
		top: triggerRect.top - tooltipRect.height < 0,
		right: windowWidth < triggerRect.left + tooltipRect.width,
		bottom: windowHeight < triggerRect.bottom + tooltipRect.height + offset,
		left: triggerRect.left - tooltipRect.width < 0,
	};

	const directionRight = collisions.right && !collisions.left;
	const directionUp = collisions.bottom && !collisions.top;

	return {
		left: directionRight
			? `${triggerRect.right - tooltipRect.width + window.pageXOffset}px`
			: `${triggerRect.left + window.pageXOffset}px`,
		top: directionUp
			? `${
					triggerRect.top - offset - tooltipRect.height + window.pageYOffset
			  }px`
			: `${
					triggerRect.top + offset + triggerRect.height + window.pageYOffset
			  }px`,
	};
};

////////////////////////////////////////////////////////////////////////////////

/**
 * useDisabledTriggerOnSafari implements a workaround for using tooltips with
 * disabled controls in Safari. Safari fires `pointerenter` but does not fire
 * `pointerleave`. Additionally, `onPointerEventLeave` added to the trigger
 * element will not work.
 * @see https://github.com/w3c/aria-practices/issues/128#issuecomment-588625727
 * @param {boolean} [disabled]
 * @param {boolean} isVisible
 * @param {React.RefObject<T>} ref
 * @template T
 */
function useDisabledTriggerOnSafari({ disabled, isVisible, ref }) {
	useEffect(() => {
		if (
			!(typeof window !== 'undefined' && 'PointerEvent' in window) ||
			!disabled ||
			!isVisible
		) {
			return;
		}

		let ownerDocument = getOwnerDocument(ref.current);

		function handleMouseMove(event) {
			if (!isVisible) return;
			if (
				event.target instanceof Element &&
				event.target.closest(
					"[data-react-lit-tooltip-trigger][data-state='tooltip-visible']",
				)
			) {
				return;
			}
			send({ type: TooltipEvents.GLOBALMOUSEMOVE });
		}

		ownerDocument.addEventListener('mousemove', handleMouseMove);
		return () => {
			ownerDocument.removeEventListener('mousemove', handleMouseMove);
		};
	}, [disabled, isVisible, ref]);
}
