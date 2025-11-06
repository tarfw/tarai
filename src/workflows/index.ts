import { Agent, createWorkflowChain } from "@voltagent/core";
import { z } from "zod";

// Export existing expense approval workflow
export { expenseApprovalWorkflow } from "./expense";

// Export commerce workflows
export {
	orderProcessingWorkflow,
	productRecommendationWorkflow,
} from "./commerce";
