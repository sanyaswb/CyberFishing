import { BaitEffectivenessKnowledgePolicy } from "./bait_effectiveness_knowledge_policy.js";

export class AlwaysKnownBaitEffectivenessPolicy extends BaitEffectivenessKnowledgePolicy {
  isDiscovered(_context) {
    return true;
  }
}
