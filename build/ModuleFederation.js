"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComponentWithFederatedImports = exports.lazyWithModules = exports.FederatedComponent = exports.useCurrentApp = exports.loadModule = exports.registerAndLoadModule = void 0;
const runtime_1 = require("@module-federation/enhanced/runtime");
const react_1 = __importStar(require("react"));
const registeredApps = [];
function registerAndLoadModule(scope, module, url) {
    if (registeredApps.includes(scope)) {
        return loadModule(scope, module);
    }
    registeredApps.push(scope);
    (0, runtime_1.registerRemotes)([
        {
            name: scope,
            entry: url,
        },
    ]);
    return loadModule(scope, module);
}
exports.registerAndLoadModule = registerAndLoadModule;
function loadModule(scope, module) {
    return async () => {
        const moduleAbsolutePath = module.substring(1);
        const remoteUrl = `${scope}${moduleAbsolutePath}`;
        return (0, runtime_1.loadRemote)(remoteUrl);
    };
}
exports.loadModule = loadModule;
const CurrentAppContext = (0, react_1.createContext)(null);
const useCurrentApp = () => {
    const contextValue = (0, react_1.useContext)(CurrentAppContext);
    if (contextValue === null) {
        throw new Error("useCurrentApp can't be used outside of CurrentAppContext.Provider");
    }
    return contextValue;
};
exports.useCurrentApp = useCurrentApp;
function FederatedComponent({ url, scope, module, app, renderOnLoading, props, }) {
    const Component = (0, react_1.useMemo)(() => {
        return (0, react_1.lazy)(registerAndLoadModule(scope, module, url));
    }, [scope, module, url]);
    if (!url || !scope || !module) {
        throw new Error("Can't federate a component without url, scope and module");
    }
    return (react_1.default.createElement(react_1.Suspense, { fallback: renderOnLoading !== null && renderOnLoading !== void 0 ? renderOnLoading : react_1.default.createElement(react_1.default.Fragment, null, "Loading...") },
        react_1.default.createElement(CurrentAppContext.Provider, { value: app },
            react_1.default.createElement(Component, { ...props }))));
}
exports.FederatedComponent = FederatedComponent;
const lazyWithModules = (functionComponent, ...modules) => {
    return react_1.default.lazy(async () => {
        const loadedModules = await Promise.all(modules.map((mod) => {
            return registerAndLoadModule(mod.scope, mod.module, mod.url)();
        }));
        const moduleExports = loadedModules.reduce((current, loadedModule, index) => ({
            ...current,
            [modules[index].module]: loadedModule,
        }), {});
        return {
            __esModule: true,
            default: (originalProps) => functionComponent({ moduleExports: moduleExports, ...originalProps }),
        };
    });
};
exports.lazyWithModules = lazyWithModules;
const ComponentWithFederatedImports = ({ renderOnError, renderOnLoading, componentWithInjectedImports, componentProps, federatedImports, }) => {
    const Component = (0, react_1.useMemo)(() => (0, exports.lazyWithModules)(componentWithInjectedImports, ...federatedImports.map((federatedImport) => ({
        scope: federatedImport.scope,
        module: federatedImport.module,
        url: federatedImport.remoteEntryUrl,
    }))), [JSON.stringify(federatedImports)]);
    return (react_1.default.createElement(react_1.Suspense, { fallback: renderOnLoading !== null && renderOnLoading !== void 0 ? renderOnLoading : react_1.default.createElement(react_1.default.Fragment, null, "Loading...") },
        react_1.default.createElement(Component, { ...componentProps })));
};
exports.ComponentWithFederatedImports = ComponentWithFederatedImports;
