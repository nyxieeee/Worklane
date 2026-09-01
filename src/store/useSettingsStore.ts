import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { uid } from '../utils';

export interface CustomLabel {
  id: string;
  name: string;
  color: string;
}

interface SettingsState {
  labelMode: 'text' | 'dot';
  customLabels: CustomLabel[];
  setLabelMode: (mode: 'text' | 'dot') => void;
  addLabel: (name: string, color: string) => void;
  removeLabel: (id: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      labelMode: 'text',
      customLabels: [],
      setLabelMode: (mode) => set({ labelMode: mode }),
      addLabel: (name, color) => set(s => ({
        customLabels: [...s.customLabels, { id: uid(), name, color }],
      })),
      removeLabel: (id) => set(s => ({
        customLabels: s.customLabels.filter(l => l.id !== id),
      })),
    }),
    { name: 'worklane_settings_v1' }
  )
);
