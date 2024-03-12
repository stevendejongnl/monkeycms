/* jshint node: true */
/* jshint esversion: 2020 */
/* jshint strict: false */

import { defaultReporter } from '@web/test-runner'
import { junitReporter } from '@web/test-runner-junit-reporter'
import { playwrightLauncher } from '@web/test-runner-playwright'


const browsers = {
  chromium: playwrightLauncher({ product: 'chromium' }),
  firefox: playwrightLauncher({ product: 'firefox', concurrency: 1 }),
  webkit: playwrightLauncher({ product: 'webkit' }),
}

const noBrowser = (b) => {
  throw new Error(`No browser configured named '${b}'; using defaults`)
}

let commandLineBrowsers
try {
  commandLineBrowsers = process.env.BROWSERS?.split(',').map(
    (browser) => browsers[browser] ?? noBrowser(browser)
  )
} catch (e) {
  console.warn(e)
}

export default {
  nodeResolve: true,
  concurrency: 10,
  browsers: commandLineBrowsers ?? Object.values(browsers),
  filterBrowserLogs: ({ type }) => type !== 'warn',
  testFramework: {
    config: {
      timeout: 4000,
    }
  },
  coverageConfig: {
    report: true,
    reportDir: 'coverage',
    reporters: ['cobertura', 'lcov'],
    exclude: [
      '**/node_modules/**/*',
    ],
    threshold: {
      statements: 70,
      branches: 70,
      functions: 70,
      lines: 70,
    },
  },
  reporters: [
    defaultReporter({
      reportTestResults: true,
      reportTestProgress: true
    }),
    junitReporter({
      outputPath: './junit-test-results.xml',
      reportLogs: true,
    }),
  ],
  groups: [
    {
      name: 'base',
      files: ['dist/base/**/*.test.js'],
      testRunnerHtml: (testFramework) => `
        <html lang="en-US">
          <body>
            <script src="dist/base/main.js" type="module"></script>
            <link rel="stylesheet" href="dist/main.css">
            <script type="module" src="${testFramework}"></script>
          </body>
        </html>
      `,
    },
  ]
}
