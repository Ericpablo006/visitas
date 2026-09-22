"use server";

import { requireUser } from "@/lib/auth/session";
import { changeOwnPasswordAction } from "@/actions/auth";
import type { ActionState } from "@/lib/action";

export async function changeOwnPasswordFormAction(prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  return changeOwnPasswordAction(user.id, prev, fd);
}
