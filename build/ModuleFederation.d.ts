import React, { FunctionComponent, ReactNode } from "react";
type Module = any;
export declare function registerAndLoadModule(scope: string, module: string, url: string): () => Promise<Module>;
export declare function loadModule(scope: string, module: string): () => Promise<Module>;
export declare const useCurrentApp: () => SolutionUI;
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
export declare function FederatedComponent({ url, scope, module, app, renderOnLoading, props, }: FederatedComponentProps & {
    props: any;
    app: SolutionUI;
    renderOnLoading?: ReactNode;
}): React.JSX.Element;
export declare const lazyWithModules: <Props extends {}>(functionComponent: FunctionComponent<React.PropsWithChildren<Props>>, ...modules: {
    module: string;
    url: string;
    scope: string;
}[]) => React.LazyExoticComponent<(originalProps: Props) => React.ReactNode>;
export declare const ComponentWithFederatedImports: <Props extends {}>({ renderOnError, renderOnLoading, componentWithInjectedImports, componentProps, federatedImports, }: {
    renderOnError?: ReactNode;
    renderOnLoading?: ReactNode;
    componentWithInjectedImports: FunctionComponent<React.PropsWithChildren<Props> & {
        moduleExports: Record<string, unknown>;
    }>;
    componentProps: Props;
    federatedImports: {
        remoteEntryUrl: string;
        scope: string;
        module: string;
    }[];
}) => React.JSX.Element;
type ShellHooks<T extends {
    shellHooks: any;
}> = T["shellHooks"];
type ShellAlerts<T extends {
    shellAlerts: any;
}> = T["shellAlerts"];
type Listener = () => void;
export declare const shellHooksStore: {
    getShellHooks: () => any;
    subscribe: (listener: Listener) => () => void;
    setShellHooks: (newHooks: any) => void;
};
export declare const shellAlertsStore: {
    getShellAlerts: () => any;
    subscribe: (listener: Listener) => () => void;
    setShellAlerts: (newAlerts: any) => void;
};
export declare const useShellHooks: <T extends {
    shellHooks: any;
}>() => ShellHooks<T>;
export declare const useShellAlerts: <T extends {
    shellAlerts: any;
}>() => ShellAlerts<T>;
export declare const ShellHooksProvider: <T extends {
    shellHooks: any;
}, K extends {
    shellAlerts: any;
}>({ shellHooks, shellAlerts, children, }: {
    shellHooks: ShellHooks<T>;
    shellAlerts: ShellAlerts<K>;
    children: ReactNode;
}) => React.JSX.Element;
export {};
