# GitHub Action - Semantic Labeler
This GitHub action labels your pull request based on conventional commits using [semantic-release](https://github.com/semantic-release/semantic-release)

### Pre requisites
Create a workflow `.yml` file in your `.github/workflows` directory. An [example workflow](#example-workflow) is available below.

For more information, reference the GitHub Help Documentation for [Creating a workflow file](https://help.github.com/en/articles/configuring-a-workflow#creating-a-workflow-file)

### Inputs
- `token`: Github authentication token
- `tag-format`: The semantic release tag format

### Outputs
- `is-release`: Whether there is a release or not
- `release-type`: The release type
- `release-name`: The name of the release
- `release-notes`: The release notes

### Example Workflow
```yaml
on:
  pull_request:
    types: [synchronize, opened]

name: GitHub action workflow name

jobs:
  context:
    name: Job name
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      - name: Semantic Labeler
        uses: woksin-org/semantic-labeler-action@v1
        
```