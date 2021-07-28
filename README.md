# Beautiful test output for go tests

This action uses [gotestfmt](https://github.com/haveyoudebuggedit/gotestfmt) to create a beautifully formatted test output in GitHub Actions.

![An animation showcasing that gotestfmt transforms a text log into an interactive log with folding sections.](https://debugged.it/projects/gotestfmt/gotestfmt.svg)

## Usage

You can use gotestfmt with the following configuration:

```yaml
jobs:
  build:
    name: Test
    runs-on: ubuntu-latest
    steps:
      # Checkout your project with git
      - name: Checkout
        uses: actions/checkout@v2

      # Install Go on the VM running the action.
      - name: Set up Go
        uses: actions/setup-go@v2
        with:
          go-version: 1.16

      # Install gotestfmt on the VM running the action.
      - name: Set up gotestfmt
        uses: haveyoudebuggedit/gotestfmt-action@v1
        with:
          # Optional: pass GITHUB_TOKEN to avoid rate limiting.
          token: ${{ secrets.GITHUB_TOKEN }}
          # Optional: pass the gotestfmt version you want to run. 
          version: v1.0.0
          # Optional: pass an organization name and repo to use a fork
          org: haveyoudebuggedit
          repo: gotestfmt

      # Run tests with nice formatting. Save the original log in /tmp/gotest.log
      - name: Run tests
        run: |
          set -euo pipefail
          go test -v ./... 2>&1 | tee /tmp/gotest.log | gotestfmt

      # Upload the original go test log as an artifact for later review.
      - name: Upload test log
        uses: actions/upload-artifact@v2
        if: always()
        with:
          name: test-log
          path: /tmp/gotest.log
          if-no-files-found: error
```

For more information about gotestfmt please see the [gotestfmt](https://github.com/haveyoudebuggedit/gotestfmt) repository.