import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp'];

export default class WallswitchExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._bgSettings = new Gio.Settings({ schema: 'org.gnome.desktop.background' });
        this._workspaceMap = null;
        this._workspaceTimeout = null;
        this._settingsSignals = [];
        this._wsSignal = null;

        this._panelBox = new St.BoxLayout({
            style_class: 'panel-button wallswitch-container',
            reactive: true,
            can_focus: true,
            track_hover: true,
            y_align: Clutter.ActorAlign.CENTER,
        });

        for (const key of ['show-search', 'show-numbers', 'number-count'])
            this._settingsSignals.push(this._settings.connect(`changed::${key}`, () => this._buildUI()));

        this._settingsSignals.push(this._settings.connect('changed::per-workspace', () => {
            if (this._settings.get_boolean('per-workspace'))
                this._initWorkspaceMap();
        }));

        this._buildUI();
        Main.panel._leftBox.insert_child_at_index(this._panelBox, 1);

        this._wsSignal = global.workspace_manager.connect('active-workspace-changed', () => {
            if (this._settings.get_boolean('per-workspace'))
                this._restoreWorkspaceWallpaper();
        });
    }

    disable() {
        for (const id of this._settingsSignals)
            this._settings.disconnect(id);
        this._settingsSignals = [];

        if (this._wsSignal) {
            global.workspace_manager.disconnect(this._wsSignal);
            this._wsSignal = null;
        }

        if (this._workspaceTimeout) {
            GLib.source_remove(this._workspaceTimeout);
            this._workspaceTimeout = null;
        }

        this._panelBox?.destroy();
        this._panelBox = null;
        this._workspaceMap = null;
    }

    _initWorkspaceMap() {
        const current = this._bgSettings.get_string('picture-uri');
        const n = global.workspace_manager.n_workspaces;
        this._workspaceMap = Object.fromEntries(
            Array.from({ length: n }, (_, i) => [i, current])
        );
    }

    _buildUI() {
        this._panelBox.destroy_all_children();
        this._searchEntry = null;

        if (this._settings.get_boolean('show-search')) {
            this._searchEntry = new St.Entry({
                hint_text: 'Search',
                style_class: 'wallswitch-search',
                can_focus: true,
                track_hover: true,
            });
            this._searchEntry.clutter_text.connect('activate', () => this._searchWallpaper());
            this._panelBox.add_child(this._searchEntry);
        }

        if (this._settings.get_boolean('show-numbers')) {
            const count = this._settings.get_int('number-count');
            for (let i = 0; i < count; i++) {
                const btn = new St.Button({
                    label: `${i + 1}`,
                    style_class: 'wallswitch-number',
                    reactive: true,
                    can_focus: true,
                    track_hover: true,
                });
                btn.connect('clicked', () => this._applyWallpaperByIndex(i));
                this._panelBox.add_child(btn);
            }
        }
    }

    _wallpaperDir() {
        const pics = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_PICTURES);
        return `${pics}/wallswitch`;
    }

    _loadWallpapers() {
        const folder = Gio.File.new_for_path(this._wallpaperDir());
        const files = [];
        try {
            const iter = folder.enumerate_children('standard::name', Gio.FileQueryInfoFlags.NONE, null);
            let info;
            while ((info = iter.next_file(null)) !== null) {
                const name = info.get_name();
                if (IMAGE_EXTS.some(ext => name.endsWith(ext)))
                    files.push(name);
            }
        } catch (e) {
            console.error(`Wallswitch: failed to read wallpaper folder: ${e.message}`);
        }
        return files.sort((a, b) => a.localeCompare(b));
    }

    _applyWallpaperByIndex(index) {
        const files = this._loadWallpapers();
        if (files.length === 0) return;

        const path = `${this._wallpaperDir()}/${files[index % files.length]}`;
        if (!GLib.file_test(path, GLib.FileTest.EXISTS)) {
            console.warn(`Wallswitch: file no longer exists: ${path}`);
            return;
        }

        this._setWallpaper(path);
    }

    _setWallpaper(filePath) {
        const uri = `file://${filePath}`;
        this._bgSettings.set_string('picture-uri', uri);
        this._bgSettings.set_string('picture-uri-dark', uri);

        if (this._settings.get_boolean('per-workspace')) {
            if (!this._workspaceMap) this._initWorkspaceMap();
            const ws = global.workspace_manager.get_active_workspace_index();
            this._workspaceMap[ws] = uri;
        }
    }

    _restoreWorkspaceWallpaper() {
        if (!this._workspaceMap) return;

        const ws = global.workspace_manager.get_active_workspace_index();
        let uri = this._workspaceMap[ws];

        if (!uri) {
            const files = this._loadWallpapers();
            if (files.length === 0) return;
            uri = `file://${this._wallpaperDir()}/${files[0]}`;
            this._workspaceMap[ws] = uri;
        }

        if (this._bgSettings.get_string('picture-uri') === uri) return;

        const filePath = uri.slice('file://'.length);
        if (!GLib.file_test(filePath, GLib.FileTest.EXISTS)) {
            const files = this._loadWallpapers();
            if (files.length === 0) return;
            uri = `file://${this._wallpaperDir()}/${files[0]}`;
            this._workspaceMap[ws] = uri;
        }

        if (this._workspaceTimeout)
            GLib.source_remove(this._workspaceTimeout);

        // Small delay so the workspace animation settles before the wallpaper switches
        this._workspaceTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 80, () => {
            this._bgSettings.set_string('picture-uri', uri);
            this._bgSettings.set_string('picture-uri-dark', uri);
            this._workspaceTimeout = null;
            return GLib.SOURCE_REMOVE;
        });
    }

    _searchWallpaper() {
        const text = this._searchEntry?.get_text()?.toLowerCase();
        if (!text) return;

        const files = this._loadWallpapers();
        const index = files.findIndex(f => f.toLowerCase().includes(text));
        if (index !== -1) this._applyWallpaperByIndex(index);
    }
}
