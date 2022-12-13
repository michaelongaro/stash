import React, { useState, useEffect } from "react";
import CreateSelectable from "react-select/creatable";
import { FaCheck, FaFolderOpen, FaTimes } from "react-icons/fa";
import { trpc } from "../../utils/trpc";
import { type IFolderOptions } from "../ImageUpload/ImageReviewModal";
import { motion } from "framer-motion";
import { useLocalStorageContext } from "../../context/LocalStorageContext";
import { useSession } from "next-auth/react";

interface ISelectedImages {
  selectedImageIDs: string[];
  setSelectedImageIDs: React.Dispatch<React.SetStateAction<string[]>>;
}

function SelectedImages({
  selectedImageIDs,
  setSelectedImageIDs,
}: ISelectedImages) {
  const { data: session } = useSession();
  const localStorageID = useLocalStorageContext();
  const { data: allUserFolders } = trpc.images.getUserFolders.useQuery(
    localStorageID?.value || session?.user?.id
  );
  const utils = trpc.useContext();

  const [folderOptions, setFolderOptions] = useState<IFolderOptions[]>([]);
  const [currentlySelectedFolder, setCurrentlySelectedFolder] =
    useState<IFolderOptions | null>(null);

  const [showCreateSelectableDropdown, setShowCreateSelectableDropdown] =
    useState<boolean>(false);

  useEffect(() => {
    if (allUserFolders && allUserFolders.length > 0) {
      const folderData: IFolderOptions[] = [];
      allUserFolders.map((folder) => {
        folderData.push({ value: folder.id, label: folder.title });
      });
      setFolderOptions(folderData);
    }
  }, [allUserFolders]);

  const moveSelectedImagesToFolder =
    trpc.images.moveSelectedImagesToFolder.useMutation({
      onMutate: () => {
        utils.images.getUserImages.cancel();
        const optimisticUpdate = utils.images.getUserImages.getData();

        if (optimisticUpdate) {
          utils.images.getUserImages.setData(optimisticUpdate);
        }
      },
      onSuccess() {
        setShowCreateSelectableDropdown(false);
        setSelectedImageIDs([]);
      },
      onSettled: () => {
        utils.images.getUserImages.invalidate();
        setShowCreateSelectableDropdown(false); // needed?
        setSelectedImageIDs([]);
      },
    });

  const deleteSelectedImages = trpc.images.deleteSelectedImages.useMutation({
    onMutate: () => {
      utils.images.getUserImages.cancel();
      const optimisticUpdate = utils.images.getUserImages.getData();

      if (optimisticUpdate) {
        utils.images.getUserImages.setData(optimisticUpdate);
      }
    },
    onSuccess() {
      setShowCreateSelectableDropdown(false);
      setSelectedImageIDs([]);
    },
    onSettled: () => {
      utils.images.getUserImages.invalidate();
      setShowCreateSelectableDropdown(false); // needed?
      setSelectedImageIDs([]);
    },
  });

  return (
    <motion.div
      key={"selectedImages"}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="m-6 flex flex-col items-center justify-center gap-2 rounded-md  bg-blue-600 p-2 sm:flex-row sm:items-center sm:justify-end"
    >
      {`${selectedImageIDs.length} image${
        selectedImageIDs.length > 1 ? "s" : ""
      } selected`}

      <button
        style={{
          display: showCreateSelectableDropdown ? "none" : "flex",
        }}
        className="secondaryBtn flex items-center justify-center gap-2"
        onClick={() => setShowCreateSelectableDropdown(true)}
      >
        <FaFolderOpen size={"1rem"} />
        Move to folder
      </button>

      {showCreateSelectableDropdown && (
        <div className="flex flex-col items-end justify-center gap-2 sm:flex-row sm:items-center sm:justify-end">
          <CreateSelectable
            isClearable
            styles={{
              option: (baseStyles, state) => ({
                ...baseStyles,
                color: "#1e3a8a",
              }),
            }}
            formatCreateLabel={(inputValue) => `Create folder "${inputValue}"`}
            options={folderOptions}
            onChange={(newFolder) => {
              if (newFolder?.label) {
                // updating list of folders in dropdown
                if (
                  folderOptions.every((elem) => elem.label !== newFolder.label)
                ) {
                  // making sure folder isn't already present)
                  const newFolderOptions = [...folderOptions];
                  newFolderOptions[newFolderOptions.length] = {
                    label: newFolder.label,
                    value: newFolder.value,
                  };
                  setFolderOptions(newFolderOptions);
                }

                setCurrentlySelectedFolder({
                  label: newFolder.label,
                  value: newFolder.value,
                });
              } else {
                // want to uncomment below once you have functionality to fully delete folder from this menu
                // (assuming you want that functionality)
                // const newFolderOptions = [...folderOptions];
                // delete newFolderOptions[index];
                // setFolderOptions(newFolderOptions);

                setCurrentlySelectedFolder(null);
              }
            }}
            value={currentlySelectedFolder}
            placeholder="Destination folder"
          />

          <div className="flex items-center justify-center gap-1">
            <button
              className="secondaryBtn"
              onClick={() => {
                setShowCreateSelectableDropdown(false);
              }}
            >
              <FaTimes size={"1rem"} />
            </button>
            <button
              className="secondaryBtn"
              disabled={!currentlySelectedFolder}
              onClick={() => {
                if (currentlySelectedFolder) {
                  moveSelectedImagesToFolder.mutate({
                    idsToUpdate: selectedImageIDs,
                    folderID: currentlySelectedFolder.value,
                  });
                }
              }}
            >
              <FaCheck size={"1rem"} />
            </button>
          </div>
        </div>
      )}

      <button
        className="dangerBtn"
        onClick={() => {
          if (currentlySelectedFolder) {
            deleteSelectedImages.mutate({
              idsToUpdate: selectedImageIDs,
            });
          }
        }}
      >{`Delete${selectedImageIDs.length > 1 ? " all" : ""}`}</button>
    </motion.div>
  );
}

export default SelectedImages;