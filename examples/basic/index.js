import * as React from 'react';
import { Tooltip } from '../../src/index';

export function Example() {
	return (
		<>
			<h2>Example: Basic</h2>
			<div>
				<Tooltip label="Notifications">
					<button>
						<span>🔔</span>
					</button>
				</Tooltip>
				<Tooltip label="Settings">
					<button>
						<span aria-hidden>⚙️</span>
					</button>
				</Tooltip>

				<span>Look to the right viewport</span>

				<div style={{ float: 'right' }}>
					<Tooltip label="Notifications" aria-label="3 Notifications">
						<button>
							<span>🔔</span>
							<span>3</span>
						</button>
					</Tooltip>
				</div>
			</div>
		</>
	);
}
