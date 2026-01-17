import { Config } from "@remotion/cli/config";
import { join } from "node:path";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setPublicDir(join(process.cwd(), "remotion-video", "public"));
