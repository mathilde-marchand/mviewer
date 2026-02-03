mviewer.customLayers.joconde = (function () {
  /**
   * Global config
   */
  const baseUrl =
    "https://data.culture.gouv.fr/api/explore/v2.1/catalog/datasets/base-joconde-extrait/records";

  let search, suggestions, clearBtn, currentValue;

  /**
   * Layers config
   */
  const layerId = "joconde";

  const vectorSource = new ol.source.Vector();

  const clusterSource = new ol.source.Cluster({
    distance: 15,
    source: vectorSource,
  });

  // todo legend dynamic en fonciton du mix et max
  function getStyle(feature) {
    const size = feature.get("features").length;
    const radius = 8 + Math.sqrt(size) * 1.5;

    return new ol.style.Style({
      image: new ol.style.Circle({
        radius: radius,
        fill: new ol.style.Fill({ color: "rgba(171, 132, 223, 0.6)" }),
        stroke: new ol.style.Stroke({ color: "white", width: 2 }),
      }),
      text: new ol.style.Text({
        text: size.toString(),
        fill: new ol.style.Fill({ color: "white" }),
        font: "bold 12px sans-serif",
      }),
    });
  }

  const layer = new ol.layer.Vector({
    source: clusterSource,
    style: getStyle,
  });

  new CustomLayer(layerId, layer, {});

  /**
   * Search by auteur
   * TODO plusieurs requêtes peuvent-être envoyées en mm temps
   */
  async function searchAuteur(auteur) {
    // config warning msg
    const fetchData = document.getElementById("warning-fetch-data");
    const noData = document.getElementById("warning-no-data");
    const limitExceeded = document.getElementById("warning-limit-exceeded");

    fetchData.classList.add("d-none");
    noData.classList.add("d-none");
    limitExceeded.classList.add("d-none");

    // config api query
    const limit = 100;
    let offset = 0;
    let total = 0;

    // clear the layer from previous data
    vectorSource.clear();

    do {
      const params =
        `?limit=${limit}` +
        `&offset=${offset}` +
        // `&where=region="Ile-de-France"&where=auteur="${auteur}"`;
        `&where=search(auteur, "${auteur}")`;

      const url = baseUrl + params;
      console.log("joconde url searchAuteur:", url);

      const response = await fetch(url);
      const data = await response.json();

      total = data.total_count;

      if (total === 0) {
        noData.classList.remove("d-none");
      } else if (total > 10000) {
        total = 10000;
        limitExceeded.classList.remove("d-none");
      } else if (total > 100) {
        fetchData.classList.remove("d-none");
      }

      data.results.forEach((musee) => {
        if (musee.coordonnees?.lon && musee.coordonnees?.lat) {
          const feature = new ol.Feature({
            geometry: new ol.geom.Point(
              ol.proj.fromLonLat([
                musee.coordonnees.lon,
                musee.coordonnees.lat,
              ]),
            ),
            // TODO add props
            auteur: musee.auteur,
            nom_officiel_musee:
              musee.nom_officiel_musee.charAt(0).toUpperCase() +
              musee.nom_officiel_musee.slice(1),
            titre: musee.titre,
            appellation: musee.appellation,
            reference: musee.reference,
          });
          vectorSource.addFeature(feature);
        }
      });

      offset += limit;
    } while (offset < total);

    fetchData.classList.add("d-none");
    setExtent();
  }

  /**
   * Init search input
   */
  function initSearchInput() {
    let debounceTimer;

    search.addEventListener("input", (e) => {
      const valeur = e.target.value;

      // On annule le timer précédent à chaque nouvelle lettre
      clearTimeout(debounceTimer);

      // Si l'input est trop court, on vide les suggestions
      if (valeur.length < 2) {
        suggestions.innerHTML = "";
        return;
      }

      // On lance le timer de 300ms
      debounceTimer = setTimeout(() => {
        getSuggestions(valeur);
      }, 300);
    });

    // recherche avec la touche enter
    search.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        console.log("Recherche enter :", event.target.value);
        clearResearch();
        searchAuteur(event.target.value);
      }
    });
    initClearBtn();
  }

  // TODO récupérer uniquement l'attribut AUTR
  async function getSuggestions(recherche) {
    const params = `?limit=100` + `&where=search(auteur, "${recherche}")`;
    // `&where=lower(auteur) like "*sout*"`;

    const url = baseUrl + params;
    console.log("joconde url getSuggestions :", url);

    const response = await fetch(url);
    const data = await response.json();

    cleanSuggestions(data.results, recherche);
  }

  function normalizeNoAccent(str) {
    return str
      .normalize("NFD") // décompose les lettres accentuées
      .replace(/[\u0300-\u036f]/g, "") // supprime les accents
      .toLowerCase()
      .trim();
  }

  function cleanSuggestions(results, recherche) {
    const auteursMap = new Map();
    const rechercheNorm = normalizeNoAccent(recherche.toLowerCase());

    results.forEach((res) => {
      // On récupère la valeur, qu'elle vienne de .auteur (Joconde) ou .auteurs (Mérimée)
      const auteurBrut = res.auteur || "";

      // On transforme tout en tableau pour traiter de la même manière "Auteur seul" et "A; B; C"
      const auteursList = auteurBrut.includes(";")
        ? auteurBrut.split(";")
        : [auteurBrut];

      auteursList.forEach((aut) => {
        // 1. Nettoyage (on enlève les dates entre parenthèses)
        const cleanedAuthor = aut.split("(")[0].trim();
        if (!cleanedAuthor) return; // Ignore les chaînes vides

        const key = normalizeNoAccent(cleanedAuthor);
        const cleanedAuthorNorm = normalizeNoAccent(
          cleanedAuthor.toLowerCase(),
        );

        // 2. Filtre par rapport à la recherche
        if (cleanedAuthorNorm.includes(rechercheNorm)) {
          if (auteursMap.has(key)) {
            const existing = auteursMap.get(key);
            // Logique de remplacement si la nouvelle version est mieux accentuée
            if (
              existing !== cleanedAuthor &&
              hasAccents(cleanedAuthor) &&
              !hasAccents(existing)
            ) {
              auteursMap.set(key, cleanedAuthor);
            }
          } else {
            auteursMap.set(key, cleanedAuthor);
          }
        }
      });
    });

    const auteursAlph = [...auteursMap.values()].sort((a, b) =>
      a.localeCompare(b),
    );
    addSuggestions(auteursAlph);
  }

  // Petite fonction helper pour la clarté
  function hasAccents(str) {
    return str !== str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  function addSuggestions(matches) {
    suggestions.innerHTML = "";
    suggestions.classList.remove("d-none");

    matches.forEach((match) => {
      const li = document.createElement("li");
      li.className = "list-group-item list-group-item-action";
      li.textContent = match;

      li.addEventListener("click", () => {
        console.log("Valeur sélectionnée :", match);
        currentValue = match;
        clearResearch();
        searchAuteur(match);
      });

      suggestions.appendChild(li);
    });
  }

  function clearResearch() {
    // vectorSource.clear();

    search.value = currentValue;
    suggestions.innerHTML = "";
    suggestions.classList.add("d-none");
    $("#right-panel").removeClass("active");
  }

  function initClearBtn() {
    clearBtn.addEventListener("click", () => {
      currentValue = "";
      vectorSource.clear();
      clearResearch();
    });
  }

  function setExtent(customExtent = null) {
    const extent = customExtent || vectorSource.getExtent();
    mviewer
      .getMap()
      .getView()
      .fit(extent, {
        padding: [70, 70, 70, 70],
        duration: 1000,
        maxZoom: 14,
      });
  }

  const handle = function (clusters, views) {
    if (clusters.length > 0) {
      var l = mviewer.getLayer(layerId);
      var elements = [];
      var html;
      var panel = "";

      clusters.forEach((c) => {
        let featuresProps = c
          ?.getProperties()
          ?.features.map((feature) =>
            feature?.properties
              ? feature.properties || feature
              : feature.getProperties(),
          );

        // Tableau dynamique titres + liens
        let htmlContent = "";

        const clusterFeatures = c?.getProperties()?.features || [];
        const clusterSize = clusterFeatures.length;

        // Regroupement des données par auteur (école, d'après...)
        const groupedByAuthor = {};

        const searchValue = currentValue.toLowerCase().trim(); // On prépare la recherche en minuscule

        featuresProps.forEach((props) => {
          const authorsList = props.auteur
            ? props.auteur
                .split(";")
                .map((a) => a.trim())
                // FILTRE : On garde l'auteur seulement s'il contient ce que l'utilisateur a tapé
                .filter((a) => a.toLowerCase().includes(searchValue))
            : [];

          authorsList.forEach((author) => {
            if (!groupedByAuthor[author]) {
              groupedByAuthor[author] = [];
            }
            groupedByAuthor[author].push(props);
          });
        });

        // Tri des noms d'auteurs par ordre alphabétique
        const sortedAuthors = Object.keys(groupedByAuthor).sort((a, b) =>
          a.localeCompare(b, "fr"),
        );

        sortedAuthors.forEach((authorName) => {
          const works = groupedByAuthor[authorName];
          // Tri des titres à l'intérieur de chaque groupe d'auteur
          works.sort((a, b) => {
            const titreA = (a.titre || a.appellation || "").toLowerCase();
            const titreB = (b.titre || b.appellation || "").toLowerCase();
            return titreA.localeCompare(titreB, "fr");
          });

          // Construction de la section HTML pour cet auteur
          htmlContent += `
            <div class="author-group">
              <h5 class="author-title">${authorName} (${works.length})</h5>
              <ul class="works-list">
          `;

          works.forEach((props) => {
            const titre = props.titre || props.appellation || "Sans titre";
            htmlContent += `
                <li>
                  <a target="_blank" href="https://pop.culture.gouv.fr/notice/joconde/${props.reference}">
                    ${titre} <i class="ri-external-link-line"></i>
                  </a>
                </li>
              `;
          });

          htmlContent += `
              </ul>
            </div>
          `;
        });

        // Agrège les valeurs uniques des propriétés supplémentaires (ADRESSE, DPT, STRUCTURE)
        const datasuppl = [
          "auteur",
          "localisation",
          "ville",
          "nom_officiel_musee",
        ].reduce((acc, key) => {
          // Filtre les valeurs nulles et les rend uniques
          const values = c
            ?.getProperties()
            ?.features.map((feature) => feature.getProperties()[key])
            .filter((value) => value != null);
          // Récupère les valeurs uniques. Attention si données pas prop
          //return { ...acc, [key]: [...new Set(values)] };
          // Récupère la 1ère valeur
          return { ...acc, [key]: values[0] || null };
        }, {});

        // Crée une nouvelle feature avec les coordonnées du cluster et les informations agrégées
        let newFeature = new ol.Feature({
          geometry: new ol.geom.Point(c?.getGeometry().getCoordinates()),
          clusterSize: clusterSize,
          htmlContent,
          ...datasuppl,
        });

        // Ajoute la nouvelle feature au tableau des éléments
        elements.push(newFeature);
      });

      // Génère le contenu HTML pour les informations des clusters
      if (l.template) {
        html = info.templateHTMLContent(elements, l);
      } else {
        html = info.formatHTMLContent(elements, l);
      }

      // Détermine le type de panneau à utiliser en fonction de la configuration mobile ou desktop
      if (configuration.getConfiguration().mobile) {
        panel = "modal-panel";
      } else {
        panel = "right-panel";
      }

      // Récupère la vue associée au panneau
      var view = views[panel];

      // Ajoute une nouvelle couche à la vue avec les informations des clusters
      view.layers.push({
        id: view.layers.length + 1, // Identifiant de la couche
        firstlayer: true, // Indique s'il s'agit de la première couche
        manyfeatures: elements.length > 1, // Indique s'il y a plusieurs features
        nbfeatures: elements.length, // Nombre de features
        name: l.name, // Nom de la couche
        layerid: layerId, // Identifiant de la couche
        theme_icon: l.icon, // Icône du thème
        html: html, // Contenu HTML généré
      });
    }
  };

  /**
   * Init
   */
  async function init() {
    // Assigner les éléments une fois que le DOM est chargé
    search = document.getElementById("search-joconde");
    suggestions = document.getElementById("suggestions-joconde");
    clearBtn = document.getElementById("clear-input-joconde");

    // Effectuer les actions de démarrage
    // currentValue = "Rembrandt";
    // if (search) {
    //   search.value = currentValue;
    //   searchAuteur(currentValue); // On lance la recherche
    // }

    // Ajuster l'extent en fonction des données muséophile
    const extent = [
      -6862476.69273741, -2423821.755270854, 6172827.400387653,
      6629305.655620225,
    ];
    setExtent(extent); // Elle zoomera sur cette zone précise

    // const searchValue = "Aachen Hans von"
    // searchAuteur(searchValue); // TODO delete*

    initSearchInput();
    // // mviewer.getMap().getView().setZoom(6.5);
  }

  return {
    joconde: layerId,
    layer: layer,
    init: init,
    handle: handle,
  };
})();
