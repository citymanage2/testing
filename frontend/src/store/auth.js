import { create } from 'zustand';
import { persist } from 'zustand/middleware';
export const useAuthStore = create()(persist((set) => ({
    token: null,
    role: null,
    login: (token, role) => set({ token, role: role }),
    logout: () => set({ token: null, role: null }),
}), { name: 'auth' }));
