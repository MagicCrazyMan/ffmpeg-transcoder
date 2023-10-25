import { Button, Form, FormInstance, Input, InputNumber, RulesProps } from "@arco-design/web-react";
import { IconFolder } from "@arco-design/web-react/icon";
import { open } from "@tauri-apps/api/dialog";
import { useMemo, useRef } from "react";
import { useAppStore } from "../../store/app";
import { useSearchStore } from "../../store/search";
import { DirectoryNotFoundError, toMessage } from "../../tauri/error";
import { verifyDirectory } from "../../tauri/system";

const inputDirectoryRules: RulesProps[] = [
  {
    validator(value: string | undefined, callback) {
      if (!value) {
        return Promise.resolve(callback());
      } else {
        return verifyDirectory(value)
          .then(() => {
            callback();
          })
          .catch((err: DirectoryNotFoundError) => {
            callback(toMessage(err));
          });
      }
    },
  },
];

/**
 * Input and Output directories input
 */
export default function Directories() {
  const {
    storage,
    setMaxDepth,
    isSearching,
    inputDir,
    outputDir,
    setInputDirectory,
    setOutputDirectory,
  } = useSearchStore();
  const saveDirectory = useAppStore((state) => state.configuration.saveDirectory);

  const formRef =
    useRef<FormInstance<{ inputDir: string; depth: number; outputDir: string }>>(null);
  const initialValues = useMemo(
    () =>
      ({
        inputDir: inputDir ?? "",
        depth: storage.maxDepth,
        outputDir: outputDir ?? saveDirectory ?? "",
      }) as { inputDir: string; outputDir: string },
    [inputDir, outputDir, saveDirectory, storage.maxDepth]
  );

  const selectDirectory = async (type: "inputDir" | "outputDir") => {
    const dir = await open({
      title: type === "inputDir" ? "Select Input Directory" : "Select Output Directory",
      defaultPath: type === "inputDir" ? undefined : saveDirectory,
      directory: true,
    });

    if (dir) {
      formRef.current?.setFieldValue(type, dir as string);
      onChange();
    }
  };

  const onChange = () => {
    formRef.current
      ?.validate()
      .then((values) => {
        setInputDirectory(values.inputDir);
        setOutputDirectory(values.outputDir);
        setMaxDepth(values.depth);
      })
      .catch(() => {
        setInputDirectory(undefined);
        setOutputDirectory(undefined);
      });
  };

  return (
    <Form
      size="mini"
      wrapperCol={{ span: 24 }}
      ref={formRef}
      initialValues={initialValues}
      onChange={onChange}
    >
      <div className="flex gap-4">
        {/* Input Directory */}
        <Form.Item field="inputDir" rules={inputDirectoryRules}>
          <Input
            allowClear
            placeholder="Input Directory"
            beforeStyle={{ padding: "0" }}
            disabled={isSearching}
            value={inputDir}
            onChange={setInputDirectory}
            addBefore={
              <Button
                type="text"
                icon={<IconFolder />}
                disabled={isSearching}
                onClick={() => selectDirectory("inputDir")}
              ></Button>
            }
          ></Input>
        </Form.Item>

        {/* Depth Input */}
        <Form.Item
          className="basis-60 flex-shrink-0"
          field="depth"
          labelCol={{ span: 8 }}
          wrapperCol={{ span: 16 }}
          label="Max Depth"
        >
          <InputNumber
            size="mini"
            min={0}
            step={1}
            disabled={isSearching}
            value={storage.maxDepth}
            onChange={setMaxDepth}
          />
        </Form.Item>
      </div>

      {/* Output Directory */}
      <Form.Item
        field="outputDir"
        extra={
          inputDir && outputDir && inputDir === outputDir
            ? "input & output directory point to same directory"
            : ""
        }
      >
        <Input
          allowClear
          placeholder="Output Directory"
          beforeStyle={{ padding: "0" }}
          value={outputDir}
          onChange={setOutputDirectory}
          addBefore={
            <Button
              type="text"
              icon={<IconFolder />}
              onClick={() => selectDirectory("outputDir")}
            ></Button>
          }
        ></Input>
      </Form.Item>
    </Form>
  );
}
