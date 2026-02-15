/**
 * File: src/components/ui/collapsible.tsx
 *
 * Radix UI Collapsible wrapper component
 * Used for progressive disclosure in forms and settings
 */

import * as React from "react";
import * as CollapsiblePrimitive from "@radix-ui/react-collapsible";

const Collapsible = CollapsiblePrimitive.Root;

const CollapsibleTrigger = CollapsiblePrimitive.CollapsibleTrigger;

const CollapsibleContent = CollapsiblePrimitive.CollapsibleContent;

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
