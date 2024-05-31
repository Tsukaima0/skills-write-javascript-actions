const core = require("@actions/core");
const github = require("@actions/github");
const lfs_core = require("lightning-flow-scanner-core/out");

async function run() {
  const GITHUB_TOKEN = core.getInput("GITHUB_TOKEN");
  const octokit = github.getOctokit(GITHUB_TOKEN);

  const { context = {} } = github;
  const { pull_request = {} } = context.payload;
  let bodytext = "";

  try {
    debug( 'Our action is running' );
    // List files in the pull request
    const { data: files } = await octokit.rest.pulls.listFiles({
      ...context.repo,
      pull_number: pull_request.number,
    });

    // Loop through each changed Flow and get its contents
    let flows = [];
    for (const file of files) {
      // Filter files based on the desired patterns
      if (file.filename.endsWith('flow-meta.xml') || file.filename.endsWith('flow')) {
        const { data: fileContent } = await octokit.rest.repos.getContent({
          ...context.repo,
          path: file.filename,
          ref: pull_request.head.sha,
        });

        // The content is base64 encoded, so decode it
        const content = Buffer.from(fileContent.content, "base64").toString("utf8");

        flows.push(new lfs_core.Flow("test", content));
      }
    }

    if(flows.length > 0){
      // Scan the flows
      const results = lfs_core.scan(flows);
      if (results) {
        for (let res of results) {
          bodytext += `Flow Name: ${res.flow.name}\n`;
        }
      } else {
        bodytext = "No issues found in the flows.";
      }
    }
    
  } catch (e) {
    console.log("" + e);
    bodytext = `Error: ${e.message}`;
  }

  // Comment on the pull request with the results
  await octokit.rest.issues.createComment({
    ...context.repo,
    issue_number: pull_request.number,
    body: bodytext,
  });
}

run();
