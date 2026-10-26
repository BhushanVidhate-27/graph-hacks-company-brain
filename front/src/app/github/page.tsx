import { GitHubRepoList } from "@/components/github-repo-list";

/**
 * GitHub issues & pull requests page for Helio.
 *
 * The underlying data is served by the container API mounted on the same
 * origin. The layout below is deliberately minimal: the table renders on the
 * client, so this page remains useful in the static export and in local dev.
 */
export default function GithubPage() {
  return (
    <main className="hc">
      <div className="hc-shell">
        <div className="hc-head">
          <h1 className="hc-title">GitHub Issues &amp; Pull Requests</h1>
          <p className="hc-note">
            See every open issue and pull request for the GitHub repository
            connected to this Helio workspace.
          </p>
        </div>

        <div className="hc-body">
          <GitHubRepoList
            owner="BhushanVidhate-27"
            repo="graph-hacks-company-brain"
          />
        </div>
      </div>
    </main>
  );
}
