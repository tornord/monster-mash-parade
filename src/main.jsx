import { css, Global } from "@emotion/react";
import React from "react";
import ReactDOM from "react-dom/client";

import { App } from "./App";

ReactDOM.createRoot(document.getElementById("root")).render(
  <>
    <Global
      styles={css`
        :root {
          font-family: Inter, Avenir, Helvetica, Arial, sans-serif;
          font-size: 14px;
          line-height: 16px;
          font-weight: 400;
        }

        html,body {
          overflow: hidden;
        }

        body {
          margin: 0;
          padding: 0;
        }
      `}
    />
    <App />
  </>
);
