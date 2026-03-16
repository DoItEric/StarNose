import {
  isMemberOfSet,
  addMemberToSet,
  removeMemberFromSet
} from "../../storage/redis";

const PROCESS_SET_KEY = "reddit_process";

export async function isPostInProcessing(uniqueKey: string): Promise<boolean> {
  return isMemberOfSet(PROCESS_SET_KEY, uniqueKey);
}

export async function addPostToProcessing(uniqueKey: string): Promise<void> {
  await addMemberToSet(PROCESS_SET_KEY, uniqueKey);
}

export async function removePostFromProcessing(uniqueKey: string): Promise<void> {
  await removeMemberFromSet(PROCESS_SET_KEY, uniqueKey);
}

