These are intended to be an extension of the worker's functionalities due to the restrictions of Cloudflare workers. They are not meant to be a replacement for the worker itself. They are meant to be used in conjunction with the worker.

The worker should `repository_dispatch` to the workflow to trigger it. The workflow will then run it's logic and return the result to the worker if necessary.


...