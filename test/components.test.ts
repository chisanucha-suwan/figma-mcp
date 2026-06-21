import { describe, it, expect } from "vitest";
import { flattenComponentProperties, collapseNode } from "../src/components.js";

describe("flattenComponentProperties", () => {
  it("flattens {type,value} into name->value", () => {
    const out = flattenComponentProperties({
      DocType: { type: "VARIANT", value: "Z100" },
      Label: { type: "TEXT", value: "Sign in" },
      Icon: { type: "INSTANCE_SWAP", value: "10:2" },
    });
    expect(out).toEqual({ DocType: "Z100", Label: "Sign in", Icon: "10:2" });
  });

  it("returns {} for undefined input", () => {
    expect(flattenComponentProperties(undefined)).toEqual({});
  });
});

describe("collapseNode", () => {
  it("collapses an instance and keeps variant props, dropping internal subtree", () => {
    const node = {
      id: "1:1",
      name: "FormValidated",
      type: "INSTANCE",
      componentId: "9:9",
      componentProperties: { DocType: { type: "VARIANT", value: "Z100" } },
      children: [{ id: "1:2", type: "TEXT", name: "label", characters: "x" }],
      overrides: [],
    };
    const out = collapseNode(node, { expandSlots: true });
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
    const out = collapseNode(node, { expandSlots: true });
    expect(out.slotContent?.map((c: any) => c.id)).toEqual(["1:3"]);
  });

  it("recurses into non-instance containers", () => {
    const node = {
      id: "f1",
      type: "FRAME",
      name: "Create Business Partner",
      children: [
        { id: "i1", type: "INSTANCE", name: "FormValidated", componentId: "9:9", componentProperties: {}, overrides: [], children: [{ id: "x", type: "TEXT" }] },
      ],
    };
    const out = collapseNode(node, { expandSlots: true });
    expect(out.children[0]).toMatchObject({ type: "INSTANCE", collapsed: true });
    expect(out.children[0].children).toBeUndefined();
  });

  it("omits slotContent when expandSlots is not set", () => {
    const node = {
      id: "1:1",
      type: "INSTANCE",
      name: "Modal",
      componentId: "9:9",
      componentProperties: {},
      overrides: [{ id: "1:3", overriddenFields: ["characters"] }],
      children: [{ id: "1:3", type: "TEXT", name: "slot", characters: "Hi" }],
    };
    const out = collapseNode(node);
    expect(out.slotContent).toBeUndefined();
    expect(out.collapsed).toBe(true);
  });
});
