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
import './nodes/builtin/bell-node.js';
import './nodes/builtin/counter-node.js';

// Import state
import { Store } from './state/store.js';

// Import rendering
import { SvgRenderer } from './rendering/svg-renderer.js';

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
import { ValidationPanel } from './ui/validation-panel.js';

class WorkflowBuilder {
    constructor() {
        this.store = new Store();
        this.snackbar = new Snackbar();

        this._initRenderer();
        this._initValidationPanel();
        this._initExecutor();
        this._initInteractions();
        this._initUI();
        this._initDemoWorkflow();

        console.log('Workflow Builder initialized');
        console.log('Registered node types:', NodeRegistry.getAllTypes().map(t => t.type));
    }

    _initRenderer() {
        const container = document.getElementById('canvas-container');
        this.renderer = new SvgRenderer(container);

        // Apply initial settings
        const settings = this.store.getSettings();
        this.renderer.setGridSettings(settings.showGrid, settings.gridSize);
        this.renderer.setViewport(100, 100, 1);

        // Sync viewport changes
        this.store.on('viewportChanged', (viewport) => {
            this.renderer.setViewport(viewport.panX, viewport.panY, viewport.zoom);
        });

        // Re-render when store changes
        this.store.on('change', () => {
            this.renderer.render(this.store.getNodes(), this.store.getConnections());
        });

        // Initial render
        this.renderer.render(this.store.getNodes(), this.store.getConnections());
    }

    _initValidationPanel() {
        this.validationPanel = new ValidationPanel(
            document.getElementById('validation-panel'),
            this.store,
            this.renderer
        );
    }

    _initExecutor() {
        this.executor = new Executor(this.store);

        this.executor.on('validationError', (errors) => {
            this.validationPanel.show(errors);
        });

        this.executor.on('started', () => {
            this.validationPanel.hide();
        });

        this.executor.on('completed', () => {
            this.snackbar.show('Workflow completed');
        });

        // Progress dimming integration
        this.executor.on('progressDimmingChanged', (enabled) => {
            this.renderer.setProgressDimming(enabled);
        });
    }

    _initInteractions() {
        // Context menu
        this.contextMenu = new ContextMenu(this.store, this.renderer, {
            onNotify: (msg) => this.snackbar.show(msg)
        });

        // Mouse handler - use SVG element
        this.mouseHandler = new MouseHandler(
            this.renderer.svg,
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

        // Sidebar toggles
        this._initSidebarToggles();
    }

    _initSidebarToggles() {
        const leftSidebar = document.getElementById('left-sidebar');
        const rightSidebar = document.getElementById('right-sidebar');
        const toggleLeft = document.getElementById('toggle-left');
        const toggleRight = document.getElementById('toggle-right');

        toggleLeft.addEventListener('click', () => {
            leftSidebar.classList.toggle('collapsed');
        });

        toggleRight.addEventListener('click', () => {
            rightSidebar.classList.toggle('collapsed');
        });
    }

    _initDemoWorkflow() {
        // Create default workflow: Scheduler → Delay → Bell → End
        const centerX = 300;
        const startY = 100;
        const spacing = 100;

        const schedulerNode = this.store.addNode('scheduler', centerX, startY);
        const delayNode = this.store.addNode('delay', centerX, startY + spacing);
        const bellNode = this.store.addNode('bell', centerX, startY + spacing * 2);
        const endNode = this.store.addNode('end', centerX, startY + spacing * 3);

        // Connect them
        this.store.addConnection(schedulerNode.id, 'output', delayNode.id, 'input');
        this.store.addConnection(delayNode.id, 'output', bellNode.id, 'input');
        this.store.addConnection(bellNode.id, 'output', endNode.id, 'input');

        // Fit to content
        setTimeout(() => {
            this.renderer.fitToContent(this.store.getNodes(), 100);
            const vp = this.renderer.viewport;
            this.store.setViewport(vp.panX, vp.panY, vp.zoom);
        }, 100);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new WorkflowBuilder();
});
