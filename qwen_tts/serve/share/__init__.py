"""Public "share work + gallery" feature.

A *share work* is a small A/B comparison (2–N synthesized clips of the same
text under one varied dimension — voice / emotion / language / temperature /
speed). Users publish one from the Studio to get a no-login ``/share/<slug>``
link; the gallery is a curated set of ``kind='gallery'`` works on the homepage.

Mirrors the ``auth`` subpackage: config → state (lifecycle) → store (Mongo +
disk) → routes. Audio bytes live on disk under ``shared_dir/<slug>/<id>.wav``;
Mongo only stores metadata + relative paths.
"""
