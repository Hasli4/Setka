const port = Number(process.env.PORT || 5177);
const baseURL = `http://127.0.0.1:${port}`;

export default {
  testDir: './tests/e2e',
  timeout: 30000,
  use: {
    baseURL,
    viewport: { width: 1280, height: 720 },
    acceptDownloads: true,
  },
  webServer: {
    command: 'npm start',
    url: baseURL,
    reuseExistingServer: true,
    timeout: 15000,
  },
};
