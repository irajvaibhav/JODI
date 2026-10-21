// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    rules: {
      'react/no-unescaped-entities': 'off', // HTML-only concern; RN <Text> renders apostrophes as-is
      'react/display-name': 'off',
      'import/namespace': 'off', // can't follow expo-notifications' `export *` re-exports
    },
  },
]);
