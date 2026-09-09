import { defineConfig, configDefaults } from 'vitest/config';
import path from 'path';

// El entorno se elige por archivo, no de forma global.
//
// Antes `environment: 'jsdom'` aplicaba a los 173 archivos de test, pero solo 61
// tocan el DOM (los .tsx, más los dos de `src/hooks` que usan `renderHook`). Los
// otros 112 —lógica de dominio, server actions, helpers— montaban un jsdom que no
// usaban.
//
// No era solo lentitud. Medido sobre `src/lib` (95 archivos, 1425 tests, mismos
// resultados con ambos entornos):
//
//   jsdom → 44.80s de reloj, 214.93s acumulados de setup de entorno
//   node  → 11.89s de reloj,  22ms  de setup de entorno
//
// Esos ~215s de montaje de jsdom compiten por CPU entre workers contra un
// `testTimeout` por defecto de 5s. Bajo cualquier carga extra (el dev server
// arriba, otro proceso), algún test se queda sin CPU y expira — en el archivo que
// toque, que es justamente el patrón "falla en la suite completa, pasa aislado y
// cambia de archivo entre corridas" de la issue #249. La causa no era estado
// compartido entre archivos, sino inanición.
export default defineConfig({
  test: {
    globals: true,
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          globals: true,
          // Todo lo que no es componente ni hook. `src/hooks` va al proyecto DOM
          // porque `renderHook` necesita un document.
          include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
          exclude: [...configDefaults.exclude, 'src/hooks/**'],
        },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          environment: 'jsdom',
          globals: true,
          include: [
            'src/**/*.test.tsx',
            'src/**/*.spec.tsx',
            'src/hooks/**/*.test.ts',
            'src/hooks/**/*.spec.ts',
          ],
        },
      },
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
