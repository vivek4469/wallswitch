import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';

import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class WallswitchPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage();
        const group = new Adw.PreferencesGroup({ title: 'Wallswitch Settings' });
        page.add(group);

        const searchToggle = new Adw.SwitchRow({
            title: 'Show Search Bar',
            subtitle: 'Display wallpaper search in top panel',
        });
        settings.bind('show-search', searchToggle, 'active', 0);
        group.add(searchToggle);

        const numbersToggle = new Adw.SwitchRow({
            title: 'Show Number Buttons',
            subtitle: 'Display wallpaper quick access buttons',
        });
        settings.bind('show-numbers', numbersToggle, 'active', 0);
        group.add(numbersToggle);

        const workspaceToggle = new Adw.SwitchRow({
            title: 'Per Workspace Wallpaper',
            subtitle: 'Each workspace can keep a different wallpaper',
        });
        settings.bind('per-workspace', workspaceToggle, 'active', 0);
        group.add(workspaceToggle);

        const spinRow = new Adw.SpinRow({
            title: 'Number Count',
            subtitle: 'Maximum visible number buttons',
            adjustment: new Gtk.Adjustment({ lower: 1, upper: 5, step_increment: 1 }),
        });
        settings.bind('number-count', spinRow, 'value', 0);
        group.add(spinRow);

        window.add(page);
    }
}
