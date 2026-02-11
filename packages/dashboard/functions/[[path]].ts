import { createPagesFunctionHandler } from "@remix-run/cloudflare-pages";

// @ts-expect-error - virtual module from Remix build
import * as build from "../build/server";

export const onRequest = createPagesFunctionHandler({ build });
