import { join } from "node:path";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setPublicDir(join(__dirname, "public"));
