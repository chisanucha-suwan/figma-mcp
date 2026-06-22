import { describe, it, expect } from "vitest";
import { FigmaClient } from "../src/figma-client.js";

const token = process.env.FIGMA_ACCESS_TOKEN;
const fileKey = process.env.FIGMA_TEST_FILE;
const run = token && fileKey ? describe : describe.skip;

run("integration: real figma file", () => {
  it("fetches file metadata", async () => {
    // Arrange
    const c = new FigmaClient({ token: token!, baseUrl: "https://api.figma.com" });
    // Act
    const file = (await c.getFile(fileKey!, { depth: 1 })) as any;
    // Assert
    expect(file.name).toBeTruthy();
    expect(file.document?.children?.length).toBeGreaterThan(0);
  });

  it("resolves at least one style value (verifies styles->node flow)", async () => {
    // Arrange
    const c = new FigmaClient({ token: token!, baseUrl: "https://api.figma.com" });
    // Act
    const styles = (await c.getFileStyles(fileKey!)) as any;
    const first = styles.meta?.styles?.[0];
    if (!first) return; // file may have no styles
    const nodes = (await c.getNodes(fileKey!, [first.node_id], { depth: 1 })) as any;
    // Assert
    expect(nodes.nodes[first.node_id]?.document).toBeTruthy();
  });
});
