import { Button, Form, Input } from "@arco-design/web-react";
import { IconFolder } from "@arco-design/web-react/icon";
import { open } from "@tauri-apps/api/dialog";
import { useEffect, useMemo, useState } from "react";
import { TauriError, toShortMessage } from "../../tauri/error";
import { TargetFile, getFilesFromDirectory } from "../../tauri/fs";

type InputOutputProps = {
  className?: string;
  inputDirectory: string;
  onInputDirectoryChanged: (dir: string) => void;
  outputDirectory: string;
  onOutputDirectoryChanged: (dir: string) => void;
  onInputFilesChanged?: (files: TargetFile[]) => void;
};

/**
 * Input and Output directories input
 * @param param0 Props
 */
export default function InputOutputDirectory({
  inputDirectory,
  outputDirectory,
  onInputDirectoryChanged,
  onOutputDirectoryChanged,
  className,
  onInputFilesChanged,
}: InputOutputProps) {
  const [inputValidate, setInputValidate] = useState({
    status: undefined as ("success" | "warning" | "error" | "validating") | undefined,
    msg: "",
  });

  /**
   * Select directory via Tauri.
   * @param title Dialog title
   * @param field Form field
   */
  const selectDirectory = async (title: string, set: (dir: string) => void) => {
    const dir = await open({
      title,
      directory: true,
    });

    if (dir) {
      set(dir as string);
    }
  };

  /**
   * Fetch target files via Tauri when input directory changed
   */
  useEffect(() => {
    setInputValidate({ status: undefined, msg: "" });

    if (!onInputFilesChanged) return;

    // clear existing immediately
    onInputFilesChanged([]);

    if (!inputDirectory) return;

    setInputValidate({ status: "validating", msg: "" });
    getFilesFromDirectory(inputDirectory)
      .then((files) => {
        onInputFilesChanged?.(files);
        setInputValidate({ status: "success", msg: "" });
      })
      .catch((error: TauriError) => {
        setInputValidate({ status: "error", msg: toShortMessage(error) });
      });
  }, [inputDirectory, onInputFilesChanged]);

  /**
   * Output directory hint message
   */
  const outputExtraMessage = useMemo(() => {
    if (inputDirectory && outputDirectory && outputDirectory === inputDirectory) {
      return "Input and Output directory refer to same directory";
    } else {
      return "";
    }
  }, [inputDirectory, outputDirectory]);

  return (
    <Form className={className} wrapperCol={{ span: 24 }}>
      {/* Input Directory */}
      <Form.Item validateStatus={inputValidate.status} help={inputValidate.msg}>
        <Input
          allowClear
          placeholder="Input Directory"
          beforeStyle={{ padding: "0" }}
          value={inputDirectory}
          onChange={onInputDirectoryChanged}
          addBefore={
            <Button
              type="text"
              icon={<IconFolder />}
              onClick={() => selectDirectory("Select Input Directory", onInputDirectoryChanged)}
            ></Button>
          }
        ></Input>
      </Form.Item>

      {/* Output Directory */}
      <Form.Item hasFeedback extra={outputExtraMessage}>
        <Input
          allowClear
          placeholder="Output Directory"
          beforeStyle={{ padding: "0" }}
          value={outputDirectory}
          onChange={onOutputDirectoryChanged}
          addBefore={
            <Button
              type="text"
              icon={<IconFolder />}
              onClick={() => selectDirectory("Select Output Directory", onOutputDirectoryChanged)}
            ></Button>
          }
        ></Input>
      </Form.Item>
    </Form>
  );
}
