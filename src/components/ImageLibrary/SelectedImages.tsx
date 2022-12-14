import React, { useState, useEffect } from "react";
import CreateSelectable from "react-select/creatable";
import { FaCheck, FaFolderOpen, FaTimes } from "react-icons/fa";
import { trpc } from "../../utils/trpc";
import { type IFolderOptions } from "../ImageUpload/ImageReviewModal";
import { AnimatePresence, motion } from "framer-motion";
import { useLocalStorageContext } from "../../context/LocalStorageContext";
import { useSession } from "next-auth/react";
import ConfirmDeleteModal from "../modals/ConfirmDeleteModal";

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
  const { data: allUserFolders } = trpc.folders.getUserFolders.useQuery(
    localStorageID?.value || session?.user?.id
  );
  const utils = trpc.useContext();

  const [folderOptions, setFolderOptions] = useState<IFolderOptions[]>([]);
  const [currentlySelectedFolder, setCurrentlySelectedFolder] =
    useState<IFolderOptions | null>(null);

  const [showCreateSelectableDropdown, setShowCreateSelectableDropdown] =
    useState<boolean>(false);
  const [showConfirmDeleteModal, setShowConfirmDeleteModal] =
    useState<boolean>(false);

  const [newlyAddedFolderID, setNewlyAddedFolderID] = useState<string>();
  const [readyToUpdate, setReadyToUpdate] = useState<boolean>(false);

  useEffect(() => {
    if (allUserFolders && allUserFolders.length > 0) {
      const folderData: IFolderOptions[] = [];
      allUserFolders.map((folder) => {
        folderData.push({ value: folder.id, label: folder.title });
      });
      setFolderOptions(folderData);
    }
  }, [allUserFolders]);

  const createFolder = trpc.folders.createFolder.useMutation({
    onMutate: () => {
      utils.folders.getUserFolders.cancel();
      const optimisticUpdate = utils.folders.getUserFolders.getData();

      if (optimisticUpdate) {
        utils.folders.getUserFolders.setData(optimisticUpdate);
      }
    },
    onSuccess(data) {
      if (data && data.id.length > 0) {
        setNewlyAddedFolderID(data.id);
      }
    },
    onSettled: () => {
      utils.folders.getUserFolders.invalidate();
    },
  });

  const moveSelectedImagesToFolder =
    trpc.images.moveSelectedImagesToFolder.useMutation({
      onMutate: () => {
        utils.images.retrieveImageFromFolder.cancel();
        const optimisticUpdate = utils.images.retrieveImageFromFolder.getData();

        if (optimisticUpdate) {
          utils.images.retrieveImageFromFolder.setData(optimisticUpdate);
        }
      },
      onSettled: () => {
        utils.images.retrieveImageFromFolder.invalidate();
        setShowCreateSelectableDropdown(false); // needed?
        setSelectedImageIDs([]);
      },
    });

  // probably redo these two effects later
  useEffect(() => {
    if (newlyAddedFolderID && newlyAddedFolderID.length > 0) {
      setReadyToUpdate(true);

      // try to use setState callback to set currentlySelectedFolder later
      if (currentlySelectedFolder?.label) {
        let prevFolderState = { ...currentlySelectedFolder };
        prevFolderState = {
          label: currentlySelectedFolder.label,
          value: newlyAddedFolderID,
        };
        setCurrentlySelectedFolder(prevFolderState);
      }
    }
  }, [currentlySelectedFolder, newlyAddedFolderID]);

  useEffect(() => {
    if (readyToUpdate) {
      // check if image was edited -> needs to be uploaded to s3 -> store new url in db

      moveSelectedImagesToFolder.mutate({
        idsToUpdate: selectedImageIDs,
        folderID:
          newlyAddedFolderID ?? currentlySelectedFolder?.value?.length
            ? currentlySelectedFolder?.value
            : null,
      });

      setReadyToUpdate(false);
      setNewlyAddedFolderID(undefined); // necessary?
    }
  }, [newlyAddedFolderID, readyToUpdate, currentlySelectedFolder]);

  return (
    <motion.div
      key={"selectedImages"}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="m-6 flex flex-col items-center justify-center gap-4 rounded-md  bg-blue-600 p-2 sm:flex-row sm:items-center sm:justify-end"
    >
      {`${selectedImageIDs.length} image${
        selectedImageIDs.length > 1 ? "s" : ""
      } selected`}

      <div className="flex flex-col items-center justify-center gap-2 sm:flex-row sm:items-center sm:justify-end">
        <button
          style={{
            display: showCreateSelectableDropdown ? "none" : "flex",
          }}
          className="secondaryBtn flex items-center justify-center gap-2"
          aria-label="Move to folder"
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
              formatCreateLabel={(inputValue) =>
                `Create folder "${inputValue}"`
              }
              options={folderOptions}
              onChange={(newFolder) => {
                if (newFolder?.label) {
                  // updating list of folders in dropdown
                  if (
                    folderOptions.every(
                      (elem) => elem.label !== newFolder.label
                    )
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
                aria-label="Cancel"
                onClick={() => {
                  setShowCreateSelectableDropdown(false);
                }}
              >
                <FaTimes size={"1rem"} />
              </button>
              <button
                className="secondaryBtn"
                aria-label="Confirm"
                disabled={!currentlySelectedFolder}
                onClick={() => {
                  if (currentlySelectedFolder) {
                    if (
                      currentlySelectedFolder &&
                      currentlySelectedFolder.value ===
                        currentlySelectedFolder.label &&
                      (localStorageID?.value || session?.user?.id)
                    ) {
                      createFolder.mutate({
                        title: currentlySelectedFolder.label,
                        userID:
                          localStorageID?.value ?? session?.user?.id ?? "",
                      });
                    } else {
                      setReadyToUpdate(true);
                    }
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
          aria-label="Delete"
          onClick={() => {
            setShowConfirmDeleteModal(true);
          }}
        >{`Delete${selectedImageIDs.length > 1 ? " all" : ""}`}</button>
      </div>

      <AnimatePresence
        initial={false}
        mode={"wait"}
        onExitComplete={() => null}
      >
        {showConfirmDeleteModal && (
          <ConfirmDeleteModal
            type={"images"}
            setShowConfirmDeleteModal={setShowConfirmDeleteModal}
            idsToDelete={selectedImageIDs}
            afterBulkImageDeletionCallback={setSelectedImageIDs}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default SelectedImages;
