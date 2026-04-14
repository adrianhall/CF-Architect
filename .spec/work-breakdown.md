# Work breakdown

The product is specified in two files:

- [stack.md](./stack.md) is the tech stack
- [spec.md](./spec.md) is the engineering spec

You need to produce a work breakdown by splitting the work into distinct atomic phases.

At the end of each phase, the following must be possible:

- All files, interfaces, types, and methods have JSDoc documentation
- `npm run check` (tsc --noEmit, eslint, prettier) runs clean
- `npm run test:coverage` shows 100% pass rate and 80% coverage
- `npm run dev` starts the dev server and I can browse to the endpoint
- I can deploy the platform using `npm run firstrun` and `npm run deploy` with an appropriate .env file

Each phase document is placed in `.spec/work/phase-XXX.md` where XXX is a zero-padded incrementing number.  The phases will be executed by an LLM coding assistant in order.  Create an AGENTS.md as well that sets required rules for each phase.

Each phase document MUST include enough detail for the LLM coding assistant when paired with stack.md and spec.md.

Each phase document MUST contain "testable features" section for manual testing and acceptance criteria.
