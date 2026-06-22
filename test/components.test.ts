import { describe, it, expect } from "vitest";
import { flattenComponentProperties, collapseNode } from "../src/components.js";

describe("flattenComponentProperties", () => {
  it("flattens {type,value} into name->value", () => {
    // Act
    const out = flattenComponentProperties({
      DocType: { type: "VARIANT", value: "Z100" },
      Label: { type: "TEXT", value: "Sign in" },
      Icon: { type: "INSTANCE_SWAP", value: "10:2" },
    });
    // Assert
    expect(out).toEqual({ DocType: "Z100", Label: "Sign in", Icon: "10:2" });
  });

  it("returns {} for undefined input", () => {
    // Act + Assert
    expect(flattenComponentProperties(undefined)).toEqual({});
  });

  it("coerces a missing value to an empty string", () => {
    // Act + Assert
    expect(flattenComponentProperties({ Label: { type: "TEXT" } as any })).toEqual({ Label: "" });
  });
});

describe("collapseNode", () => {
  it("collapses an instance and keeps variant props, dropping internal subtree", () => {
    // Arrange
    const node = {
      id: "1:1",
      name: "FormValidated",
      type: "INSTANCE",
      componentId: "9:9",
      componentProperties: { DocType: { type: "VARIANT", value: "Z100" } },
      children: [{ id: "1:2", type: "TEXT", name: "label", characters: "x" }],
      overrides: [],
    };
    // Act
    const out = collapseNode(node, { expandSlots: true });
    // Assert
    expect(out).toMatchObject({
      id: "1:1",
      type: "INSTANCE",
      name: "FormValidated",
      componentId: "9:9",
      componentProperties: { DocType: "Z100" },
      collapsed: true,
    });
    expect(out.children).toBeUndefined();
  });

  it("surfaces overridden children as slotContent when expandSlots", () => {
    // Arrange
    const node = {
      id: "1:1",
      type: "INSTANCE",
      name: "Modal",
      componentId: "9:9",
      componentProperties: {},
      overrides: [{ id: "1:3", overriddenFields: ["characters"] }],
      children: [
        { id: "1:2", type: "RECTANGLE", name: "bg" },
        { id: "1:3", type: "TEXT", name: "slot", characters: "Hi" },
      ],
    };
    // Act
    const out = collapseNode(node, { expandSlots: true });
    // Assert
    expect(out.slotContent?.map((c: any) => c.id)).toEqual(["1:3"]);
  });

  it("recurses into non-instance containers", () => {
    // Arrange
    const node = {
      id: "f1",
      type: "FRAME",
      name: "Create Business Partner",
      children: [
        { id: "i1", type: "INSTANCE", name: "FormValidated", componentId: "9:9", componentProperties: {}, overrides: [], children: [{ id: "x", type: "TEXT" }] },
      ],
    };
    // Act
    const out = collapseNode(node, { expandSlots: true });
    // Assert
    expect(out.children[0]).toMatchObject({ type: "INSTANCE", collapsed: true });
    expect(out.children[0].children).toBeUndefined();
  });

  it("omits slotContent when expandSlots is not set", () => {
    // Arrange
    const node = {
      id: "1:1",
      type: "INSTANCE",
      name: "Modal",
      componentId: "9:9",
      componentProperties: {},
      overrides: [{ id: "1:3", overriddenFields: ["characters"] }],
      children: [{ id: "1:3", type: "TEXT", name: "slot", characters: "Hi" }],
    };
    // Act
    const out = collapseNode(node);
    // Assert
    expect(out.slotContent).toBeUndefined();
    expect(out.collapsed).toBe(true);
  });

  it("ignores override entries without an id and emits no slotContent when there are no children", () => {
    // Arrange
    const node = {
      id: "1:1",
      type: "INSTANCE",
      name: "X",
      componentId: "9:9",
      componentProperties: {},
      overrides: [{ overriddenFields: ["x"] }, { id: "1:2" }], // first has no id -> skipped
    };
    // Act
    const out = collapseNode(node, { expandSlots: true });
    // Assert — no children array, so nothing to surface
    expect(out.slotContent).toBeUndefined();
    expect(out.collapsed).toBe(true);
  });

  it("treats a missing overrides array as no overrides (expandSlots, with children)", () => {
    // Arrange
    const node = { id: "1:1", type: "INSTANCE", name: "X", componentId: "9:9", componentProperties: {}, children: [{ id: "c", type: "TEXT" }] };
    // Act
    const out = collapseNode(node, { expandSlots: true });
    // Assert — no overrides -> nothing overridden -> no slotContent
    expect(out.slotContent).toBeUndefined();
  });
});
