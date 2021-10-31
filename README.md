# @react-lit/tooltip

When the user's mouse or focus rests on an element, a non-interactive popup is
displayed near it.

> **NOTE:** Touch events are currently not supported. There's not a lot of
> research or examples of these types of tooltips on mobile. Please adjust
> your interfaces on mobile to account for this.

## Installation

```bash
$ npm i @react-lit/tooltip
# or
$ yarn add @react-lit/tooltip
```

## Example

```js
import Tooltip, { useTooltip, TooltipPopup } from '@react-lit/tooltip';
import VisuallyHidden from '@react-lit/visually-hidden';

function Example() {
	return (
		<Tooltip label="Close">
			<button>
				<VisuallyHidden>Close</VisuallyHidden>
				<span aria-hidden>🔒</span>
			</button>
		</Tooltip>
	);
}
```

## Development

(1) Install dependencies

```bash
$ npm i
# or
$ yarn
```

(2) Run initial validation

```bash
$ ./Taskfile.sh validate
```

(3) Run tests in watch-mode to validate functionality.

```bash
$ ./Taskfile test -w
```

---

_This project was set up by @jvdx/core_
