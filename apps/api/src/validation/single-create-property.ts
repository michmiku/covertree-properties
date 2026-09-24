import {
  GraphQLError,
  Kind,
  OperationTypeNode,
  type ASTVisitor,
  type SelectionSetNode,
  type ValidationContext,
} from 'graphql';
import type { Plugin } from 'graphql-yoga';

export const SINGLE_CREATE_MESSAGE = 'Only one createProperty is allowed per request.';

/**
 * SPEC S5.9: each createProperty makes one Weatherstack call, so aliases
 * (`a: createProperty(…) b: createProperty(…)`) would let one request spend the monthly quota.
 * Rejected during validation, before any resolver runs.
 */
export function singleCreateProperty(context: ValidationContext): ASTVisitor {
  return {
    OperationDefinition(node) {
      if (node.operation !== OperationTypeNode.MUTATION) return;
      if (countCreates(node.selectionSet, context, new Set()) > 1) {
        context.reportError(new GraphQLError(SINGLE_CREATE_MESSAGE, { nodes: node }));
      }
    },
  };
}

/** Registers `singleCreateProperty` with Yoga's validation phase. */
export const singleCreatePropertyPlugin: Plugin = {
  onValidate({ addValidationRule }) {
    addValidationRule(singleCreateProperty);
  },
};

/** Root-level createProperty fields, including those inside fragments. */
function countCreates(
  selectionSet: SelectionSetNode,
  context: ValidationContext,
  seenFragments: Set<string>,
): number {
  let count = 0;
  for (const selection of selectionSet.selections) {
    if (selection.kind === Kind.FIELD) {
      if (selection.name.value === 'createProperty') count += 1;
    } else if (selection.kind === Kind.INLINE_FRAGMENT) {
      count += countCreates(selection.selectionSet, context, seenFragments);
    } else if (!seenFragments.has(selection.name.value)) {
      seenFragments.add(selection.name.value);
      const fragment = context.getFragment(selection.name.value);
      if (fragment) count += countCreates(fragment.selectionSet, context, seenFragments);
    }
  }
  return count;
}
