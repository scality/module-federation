import {
  loadRemote,
  registerRemotes,
} from "@module-federation/enhanced/runtime";
import React, {
  FunctionComponent,
  ReactNode,
  Suspense,
  createContext,
  lazy,
  useContext,
  useMemo,
} from "react";
type Module = any;

const registeredApps: string[] = [];
export function registerAndLoadModule(
  scope: string,
  module: string,
  url: string
): () => Promise<Module> {
  if (registeredApps.includes(scope)) {
    return loadModule(scope, module);
  }

  registeredApps.push(scope);
  registerRemotes([
    {
      name: scope,
      entry: url,
    },
  ]);

  return loadModule(scope, module);
}

export function loadModule(
  scope: string,
  module: string
): () => Promise<Module> {
  return async () => {
    const moduleAbsolutePath = module.substring(1);

    const remoteUrl = `${scope}${moduleAbsolutePath}`;

    return loadRemote(remoteUrl);
  };
}

const CurrentAppContext = createContext<SolutionUI | null>(null);

export const useCurrentApp = () => {
  const contextValue = useContext(CurrentAppContext);

  if (contextValue === null) {
    throw new Error(
      "useCurrentApp can't be used outside of CurrentAppContext.Provider"
    );
  }

  return contextValue;
};

export type FederatedComponentProps = {
  url: string;
  scope: string;
  module: string;
};

export type SolutionUI = {
  kind: string;
  url: string;
  name: string;
  version: string;
  appHistoryBasePath: string;
};

export function FederatedComponent({
  url,
  scope,
  module,
  app,
  renderOnLoading,
  props,
}: FederatedComponentProps & {
  props: any;
  app: SolutionUI;
  renderOnLoading?: ReactNode;
}) {
  const Component = useMemo(() => {
    return lazy(registerAndLoadModule(scope, module, url));
  }, [scope, module, url]);

  if (!url || !scope || !module) {
    throw new Error("Can't federate a component without url, scope and module");
  }

  return (
    <Suspense fallback={renderOnLoading ?? <>Loading...</>}>
      <CurrentAppContext.Provider value={app}>
        <Component {...props} />
      </CurrentAppContext.Provider>
    </Suspense>
  );
}

export const lazyWithModules = <Props extends {}>(
  functionComponent: FunctionComponent<Props>,
  ...modules: { module: string; url: string; scope: string }[]
) => {
  return React.lazy(async () => {
    const loadedModules = await Promise.all(
      modules.map((mod) => {
        return registerAndLoadModule(mod.scope, mod.module, mod.url)();
      })
    );
    const moduleExports = loadedModules.reduce(
      (current, loadedModule, index) => ({
        ...current,
        [modules[index].module]: loadedModule,
      }),
      {}
    );
    return {
      __esModule: true,
      default: (originalProps: Props) =>
        functionComponent({ moduleExports: moduleExports, ...originalProps }),
    };
  });
};

export const ComponentWithFederatedImports = <Props extends {}>({
  renderOnError,
  renderOnLoading,
  componentWithInjectedImports,
  componentProps,
  federatedImports,
}: {
  renderOnError?: ReactNode;
  renderOnLoading?: ReactNode;
  componentWithInjectedImports: FunctionComponent<
    Props & { moduleExports: Record<string, unknown> }
  >;
  componentProps: Props;
  federatedImports: {
    remoteEntryUrl: string;
    scope: string;
    module: string;
  }[];
}) => {
  const Component = useMemo(
    () =>
      lazyWithModules(
        componentWithInjectedImports,
        ...federatedImports.map((federatedImport) => ({
          scope: federatedImport.scope,
          module: federatedImport.module,
          url: federatedImport.remoteEntryUrl,
        }))
      ),
    [JSON.stringify(federatedImports)]
  );

  return (
    <Suspense fallback={renderOnLoading ?? <>Loading...</>}>
      {/*@ts-expect-error*/}
      <Component {...componentProps} />
    </Suspense>
  );
};
