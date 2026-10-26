import { useEffect, useState } from "react";

export interface GitHubItem {
  id: string;
  number: number;
  title: string;
  state: string;
  user: { login: string } | null;
  labels: { name: string; color: string }[];
  comments: number;
  created_at: string | null;
  updated_at: string | null;
  pull_request: boolean;
  html_url: string;
}

export interface GitHubItemsResponse {
  configured: boolean;
  owner: string;
  repo: string;
  state: string;
  items: GitHubItem[];
  error?: string;
}

interface Props {
  owner: string;
  repo: string;
}

/**
 * Client component that reads GitHub issues and pull requests through the
 * container's own GitHub integration API.
 *
 * Frames:
 *   SETUP -> loading
 *   -> SUCCESS with rows
 *   -> ERROR with message
 *
 * The UI is plain Tailwind + this file's host stylesheet. If your host
 * stylesheet defines `hc-` classes they are reused where possible.
 */
export function GitHubRepoList({ owner, repo }: Props) {
  const [items, setItems] = useState<GitHubItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(
          `/api/repo/items?state=open&owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`,
        );
        if (!res.ok) {
          throw new Error(`GitHub sync returned HTTP ${res.status}`);
        }

        const data: GitHubItemsResponse = await res.json();
        if (!alive) return;

        if (!data.configured) {
          setItems([]);
          setError(
            `Not configured. Set GITHUB_OWNER, GITHUB_REPO and GITHUB_TOKEN in your .env file.`,
          );
          return;
        }

        setItems(data.items || []);
      } catch (error_) {
        if (!alive) return;
        setError(error_ instanceof Error ? error_.message : String(error_));
        setItems([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [owner, repo]);

  const pullItems = items.filter((i) => i.pull_request);
  const issueItems = items.filter((i) => !i.pull_request);

  return (
    <section className="hc">
      <div className="hc-head">
        <h1 className="hc-title">
          GitHub &ldquo;{repo}&rdquo; &mdash; issues &amp; pull requests
        </h1>
        <p className="hc-note">
          {loading
            ? &ldquo;Syncing from GitHub&hellip;&rdquo;
            : error
            ? `Sync error: ${error}`
            : `Showing ${items.length} item${items.length === 1 ? "s" : ""} so far.`}
        </p>
      </div>

      {error && !loading && (
        <div className="hc-error">
          <p>{error}</p>
        </div>
      )}

      {loading && (
        <div className="hc-loading">
          <div className="hc-spinner" />
          <p>Syncing from GitHub&hellip;</p>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="hc-empty">
          <p>No open issues or pull requests right now.</p>
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="hc-table-wrap">
          <table className="hc-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Type</th>
                <th>Title</th>
                <th>State</th>
                <th>Author</th>
                <th>Labels</th>
                <th>Comments</th>
                <th>Updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <a href={item.html_url} target="_blank" rel="noreferrer">
                      #{item.number}
                    </a>
                  </td>
                  <td>{item.pull_request ? <span>Pull request</span> : <span>Issue</span>}</td>
                  <td className="truncate">{item.title}</td>
                  <td>
                    <span
                      className={`hc-badge hc-badge-${item.state === "open" ? "green" : "red"}`}
                    >
                      {item.state}
                    </span>
                  </td>
                  <td>{item.user?.login ?? &ldquo;&mdash;&rdquo;}</td>
                  <td className="truncate">
                    {item.labels.map((label) => (
                      <span
                        key={label.name}
                        className="hc-tag"
                        style={{ backgroundColor: `#${label.color}` }}
                      >
                        {label.name}
                      </span>
                    ))}
                  </td>
                  <td>{item.comments}</td>
                  <td>{item.updated_at ?? &ldquo;&mdash;&rdquo;}</td>
                  <td>
                    <a href={item.html_url} target="_blank" rel="noreferrer" className="hc-link">
                      Open
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="hc-meta">
          <p>
            {issueItems.length} issue{issueItems.length === 1 ? "s" : ""},{" "}
            {pullItems.length} pull request{pullItems.length === 1 ? "s" : ""}
          </p>
        </div>
      )}
    </section>
  );
}
