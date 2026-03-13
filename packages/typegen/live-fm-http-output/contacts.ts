/**
 * Put your custom overrides or transformations here.
 * Changes to this file will NOT be overwritten.
 */
import { z } from "zod/v4";
import { Zcontacts as Zcontacts_generated } from "./generated/contacts";

export const Zcontacts = Zcontacts_generated;

export type Tcontacts = z.infer<typeof Zcontacts>;
