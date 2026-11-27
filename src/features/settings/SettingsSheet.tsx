import { useQueryClient } from '@tanstack/react-query';
import { useId } from 'react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Checkbox, RadioGroup, SelectField } from '@/components/ui/fields';
import { Sheet } from '@/components/ui/Sheet';
import { AboutPrivacy } from '@/features/about/AboutPrivacy';
import { LANGUAGE_OPTIONS } from '@/features/profile/labels';
import { ScenarioPicker } from '@/features/profile/ScenarioPicker';
import { useAppStores, useProfile, useSettings } from '@/features/profile/stores';

const THEME_OPTIONS = [
  ['system', 'Match my device'],
  ['light', 'Light'],
  ['dark', 'Dark'],
] as const;

interface SettingsSheetProps {
  /** Called after "Clear all my data", so the app can move focus. */
  onCleared: () => void;
}

/** Settings (UI_UX.md §3.3, PRD US-8). BYOK arrives with the AI layer (Phase 6). */
export function SettingsSheet({ onCleared }: SettingsSheetProps) {
  const stores = useAppStores();
  const settings = useSettings();
  const profile = useProfile();
  const queryClient = useQueryClient();
  const id = useId();

  return (
    <Sheet trigger={<Button variant="secondary">Settings</Button>} title="Settings">
      <div className="space-y-8">
        <RadioGroup
          id={`${id}-theme`}
          name={`${id}-theme`}
          legend="Theme"
          options={THEME_OPTIONS}
          value={settings.theme}
          onChange={(theme) => {
            stores.updateSettings({ theme });
          }}
        />

        {profile && (
          <SelectField
            id={`${id}-language`}
            label="Language for advice"
            hint="The plan and chat answers use this language. The app itself stays in English."
            placeholder="English"
            options={LANGUAGE_OPTIONS.filter(([value]) => value !== 'en')}
            value={profile.language === 'en' ? '' : profile.language}
            onChange={(language) => {
              stores.profile.set({ ...profile, language: language === '' ? 'en' : language });
            }}
          />
        )}

        <Checkbox
          id={`${id}-remember`}
          label="Remember my location on this device"
          hint="Saved rounded to about 1 km. Turn off to forget it when you close the page."
          checked={settings.rememberLocation}
          onChange={(rememberLocation) => {
            stores.updateSettings({ rememberLocation });
          }}
        />

        <div className="flex flex-wrap gap-3">
          <ScenarioPicker trigger={<Button variant="secondary">Try a sample household</Button>} />
          <AboutPrivacy trigger={<Button variant="secondary">About &amp; privacy</Button>} />
        </div>

        <section aria-labelledby={`${id}-danger`} className="border-t border-border pt-6">
          <h3 id={`${id}-danger`} className="text-lg font-semibold">
            Your data
          </h3>
          <p className="mt-1 text-muted">
            Removes your household, location and settings from this browser.
          </p>
          <div className="mt-3">
            <ConfirmDialog
              trigger={<Button variant="danger">Clear all my data</Button>}
              title="Clear all your data?"
              description="This removes your household, saved location and settings from this browser. It cannot be undone."
              confirmLabel="Clear everything"
              onConfirm={() => {
                stores.clearAll();
                queryClient.clear();
                onCleared();
              }}
            />
          </div>
        </section>
      </div>
    </Sheet>
  );
}
