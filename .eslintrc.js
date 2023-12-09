module.exports = {
  env: {
    browser: true,
    es2021: true,
  },
  include: ["src/**/*.ts", ".eslintrc.js"],
  extends: ["standard-with-typescript", "prettier"],
  overrides: [
    {
      env: {
        node: true,
      },
      files: [".eslintrc.{js,cjs}"],
      parserOptions: {
        sourceType: "script",
      },
    },
  ],
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    project: "tsconfig.json",
  },
  ignorePatterns: ["./dist/*"],
  rules: {},
};
