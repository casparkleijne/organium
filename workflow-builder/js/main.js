/**
 * Main entry point - bootstraps the application
 */

// Import core
import { NodeRegistry } from './core/registry.js';

// Import all built-in nodes (self-registering)
import './nodes/builtin/start-node.js';
import './nodes/builtin/end-node.js';
import './nodes/builtin/scheduler-node.js';
import './nodes/builtin/constant-node.js';
import './nodes/builtin/action-node.js';
import './nodes/builtin/delay-node.js';
import './nodes/builtin/log-node.js';
import './nodes/builtin/calculate-node.js';
import './nodes/builtin/decision-node.js';
import './nodes/builtin/splitter-node.js';
import './nodes/builtin/await-all-node.js';
import './nodes/builtin/gate-node.js';

// Import state
import { Store } from './state/store.js';

// Import rendering
import { Renderer } from './rendering/renderer.js';

// Import interactions
import { MouseHandler } from './interaction/mouse-handler.js';
import { KeyboardHandler } from './interaction/keyboard-handler.js';

// Import workflow
import { Executor } from './workflow/executor.js';

// Import UI
import { Palette } from './ui/palette.js';
import { PropertyPanel } from './ui/property-panel.js';
import { ContextMenu } from './ui/context-menu.js';
import { Snackbar } from './ui/snackbar.js';
import { RunControls } from './ui/run-controls.js';
import { CanvasControls } from './ui/canvas-controls.js';
import { SettingsPanel } from './ui/settings-panel.js';

class WorkflowBuilder {
    constructor() {
        this.store = new Store();
        this.snackbar = new Snackbar();

        this._initCanvas();
        this._initRenderer();
        this._initExecutor();
        this._initInteractions();
        this._initUI();
        this._initDemoWorkflow();
        this._startRenderLoop();

        console.log('Workflow Builder initialized');
        console.log('Registered node types:', NodeRegistry.getAllTypes().map(t => t.type));
    }

    _initCanvas() {
        this.canvas = document.getElementById('canvas');
        this.minimapCanvas = document.getElementById('minimap');

        // Set canvas size
        this._resizeCanvas();
        window.addEventListener('resize', () => this._resizeCanvas());
    }

    _resizeCanvas() {
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;

        if (this.renderer) {
            this.renderer.resize(this.canvas.width, this.canvas.height);
        }
    }

    _initRenderer() {
        this.renderer = new Renderer(this.canvas, this.minimapCanvas);

        // Apply initial settings
        const settings = this.store.getSettings();
        this.renderer.setGridSettings(settings.showGrid, settings.gridSize);
        this.renderer.setViewport(100, 100, 1);

        // Sync viewport changes
        this.store.on('viewportChanged', (viewport) => {
            this.renderer.setViewport(viewport.panX, viewport.panY, viewport.zoom);
        });

        // Re-render when store changes (e.g., during workflow execution)
        this.store.on('change', () => {
            this.renderer.requestRender();
        });
    }

    _initExecutor() {
        this.executor = new Executor(this.store);

        this.executor.on('validationError', (errors) => {
            const errorMsg = errors.find(e => e.type === 'error');
            this.snackbar.show(errorMsg ? errorMsg.message : 'Validation failed');
        });

        this.executor.on('completed', () => {
            this.snackbar.show('Workflow completed');
        });
    }

    _initInteractions() {
        // Context menu
        this.contextMenu = new ContextMenu(this.store, this.renderer, {
            onNotify: (msg) => this.snackbar.show(msg)
        });

        // Mouse handler
        this.mouseHandler = new MouseHandler(
            this.canvas,
            this.store,
            this.renderer,
            (x, y, node, connection, worldPos) => {
                this.contextMenu.show(x, y, node, connection, worldPos);
            }
        );

        // Keyboard handler
        this.keyboardHandler = new KeyboardHandler(
            this.store,
            this.renderer,
            this.mouseHandler,
            this.executor,
            {
                onNotify: (msg) => this.snackbar.show(msg),
                onEscape: () => this.contextMenu.hide()
            }
        );
    }

    _initUI() {
        // Left sidebar - Palette
        this.palette = new Palette(
            document.getElementById('palette'),
            this.store,
            this.renderer
        );

        // Left sidebar - Settings
        this.settingsPanel = new SettingsPanel(
            document.getElementById('settings'),
            this.store,
            this.renderer,
            { onNotify: (msg) => this.snackbar.show(msg) }
        );

        // Right sidebar - Property panel
        this.propertyPanel = new PropertyPanel(
            document.getElementById('properties'),
            this.store,
            this.renderer
        );

        // Run controls
        this.runControls = new RunControls(
            document.getElementById('run-controls'),
            this.store,
            this.executor
        );

        // Canvas controls
        this.canvasControls = new CanvasControls(
            document.getElementById('canvas-controls'),
            this.store,
            this.renderer,
            this.mouseHandler.panZoomHandler
        );
    }

    _initDemoWorkflow() {
        // Create demo workflow as per spec
        const startX = 300;
        const startY = 100;

        // Constant nodes (data providers)
        const constA = this.store.addNode('constant', startX - 150, startY);
        constA.setProperty('name', 'a');
        constA.setProperty('dataType', 'number');
        constA.setProperty('value', '5');

        const constB = this.store.addNode('constant', startX + 150, startY);
        constB.setProperty('name', 'b');
        constB.setProperty('dataType', 'number');
        constB.setProperty('value', '3');

        // Calculate node
        const calc = this.store.addNode('calculate', startX, startY + 120);
        calc.setProperty('inputA', 'a');
        calc.setProperty('inputB', 'b');
        calc.setProperty('operator', '+');
        calc.setProperty('outputKey', 'result');

        // Start node
        const start = this.store.addNode('start', startX - 200, startY + 240);

        // Gate node
        const gate = this.store.addNode('gate', startX, startY + 240);

        // Delay node
        const delay = this.store.addNode('delay', startX, startY + 360);
        delay.setProperty('seconds', 2);

        // Log node
        const log = this.store.addNode('log', startX, startY + 460);
        log.setProperty('watchKey', 'result');

        // End node
        const end = this.store.addNode('end', startX, startY + 560);

        // Create connections
        // Constant A -> Calculate
        this.store.addConnection(constA.id, 'output', calc.id, 'input');

        // Constant B -> Calculate (need to go through constant A first to add B value)
        // Actually, we need a different pattern - let's chain them
        // For this demo, let's simplify:

        // Start -> Gate (trigger)
        this.store.addConnection(start.id, 'output', gate.id, 'trigger');

        // Calculate -> Gate (data)
        this.store.addConnection(calc.id, 'output', gate.id, 'data');

        // Gate -> Delay
        this.store.addConnection(gate.id, 'output', delay.id, 'input');

        // Delay -> Log
        this.store.addConnection(delay.id, 'output', log.id, 'input');

        // Log -> End
        this.store.addConnection(log.id, 'output', end.id, 'input');

        // We need to chain the constants
        // Actually, for the enrichment model to work, we need:
        // Start -> ConstA -> ConstB -> Calculate -> Gate (data path)
        // Let's fix this:

        // Remove old connections and recreate properly
        this.store.connections.clear();

        // Create a proper flow:
        // Start triggers the gate
        // Constant A -> Constant B -> Calculate provides the data path

        // Data path: constA -> constB -> calc -> gate(data)
        this.store.addConnection(constA.id, 'output', constB.id, 'input');
        this.store.addConnection(constB.id, 'output', calc.id, 'input');
        this.store.addConnection(calc.id, 'output', gate.id, 'data');

        // Trigger path: start -> gate(trigger)
        this.store.addConnection(start.id, 'output', gate.id, 'trigger');

        // Rest: gate -> delay -> log -> end
        this.store.addConnection(gate.id, 'output', delay.id, 'input');
        this.store.addConnection(delay.id, 'output', log.id, 'input');
        this.store.addConnection(log.id, 'output', end.id, 'input');

        // Fit to content
        setTimeout(() => {
            this.renderer.fitToContent(this.store.getNodes(), 100);
            const vp = this.renderer.viewport;
            this.store.setViewport(vp.panX, vp.panY, vp.zoom);
        }, 100);
    }

    _startRenderLoop() {
        this.renderer.startRenderLoop(() => this.store.getState());
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new WorkflowBuilder();
});
