# Gubbs Factory Planner

## Run locally

Install the .NET 10 SDK and Node.js, then run the backend and frontend in separate terminals.

Backend:

```powershell
dotnet run --project backend/backend.csproj --launch-profile http
```

Frontend:

```powershell
npm install
npm run dev
```

In PowerShell on Windows, use `npm.cmd` if script execution policy blocks `npm`:

```powershell
npm.cmd install
npm.cmd run dev
```

Open `http://localhost:5173` in a browser. The backend listens on `http://localhost:5116`.

## Saved projects

Server saved projects are stored per user in the Documents folder at `Codex/factory-planner-data`. The backend creates this directory on first run. You can override it by setting the `ProjectStore__Directory` environment variable.

The server file store is local to each computer. To move a project to another computer, use **Export file** on the source computer and **Import file** on the destination computer.

## Original template notes

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
